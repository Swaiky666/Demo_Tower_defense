/*jshint esversion: 6 */
// @ts-check

import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import * as T from "../libs/CS559-Three/build/three.module.js";
import { DetailedHelicopter, Helipad } from "./DetailedHelicopter.js";
import { Zombie, initSharedDetector, getPoseModelType } from "./Zombie.js";

// ==================== 全局变量 ====================
let world;
let helicopters = [];
let zombies = [];
let helipads = [];
let statusDiv;
let zombieCountDiv;
let heliCountDiv;
let killCountDiv;
let goldDisplayDiv;
let healthDisplayDiv;
let waveNumberDiv;
let waveLabelDiv;
let sharedDetector = null;
let skeletonCanvas;
let skeletonCtx;

// 游戏状态
let baseHealth = 5;
let gameOver = false;
let baseObject;
let hearts = [];
let turret;
let muzzleFlashes = [];
let bullets = [];

// 经济系统
let playerGold = 500;
let totalKills = 0;
let currentWave = 1;
let spawnInterval = 5000; // 初始5秒生成一个
let zombieSpeedMultiplier = 1.0;

// 基地参数
const BASE_RADIUS = 2.8;
const TURRET_DAMAGE = 50;
const HELI_DAMAGE = 30;
const ZOMBIE_BASE_HEALTH = 1000; // 基础血量1000
const ZOMBIE_GOLD_REWARD = 30; // reward per zombie kill
const HELI_PRICE = 500;

// Spawn distance for zombies along the border (from base center)
const SPAWN_DISTANCE = 22;

// DEBUG计数器
let debugFrameCount = 0;
let lastDebugTime = Date.now();
let lastWaveTime = Date.now();
let zombieSpawnTimer = null;

// ==================== 初始化世界 ====================
world = new GrWorld({
    groundplanecolor: "#2a4d2a",
    groundplanesize: 50,
    // use viewport size for width and double for height
    width: window.innerWidth,
    height: window.innerHeight * 2,
    where: document.getElementById("div1")
});

// Ensure renderer and camera update on window resize so the aspect ratio is correct
function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (world && world.renderer && world.camera) {
        // adjust renderer to match the viewport
        world.renderer.setSize(w, h, false);
        // ensure the canvas spans the #div1 container
        if (world.renderer.domElement) {
            world.renderer.domElement.style.width = `100%`;
            world.renderer.domElement.style.height = `100%`;
        }
        // update camera aspect to viewport
        world.camera.aspect = w / h;
        world.camera.updateProjectionMatrix();
        if (world.solo_camera) {
            world.solo_camera.aspect = w / h;
            world.solo_camera.updateProjectionMatrix();
        }
    }
    // Sync the comparison sizes (video and skeleton canvas)
    syncComparisonSizes();
}
window.addEventListener('resize', onWindowResize);
onWindowResize();

// 获取UI元素
statusDiv = document.getElementById("status");
zombieCountDiv = document.getElementById("zombie-count");
heliCountDiv = document.getElementById("heli-count");
killCountDiv = document.getElementById("kill-count");
goldDisplayDiv = document.getElementById("gold-display");
healthDisplayDiv = document.getElementById("health-display");
waveNumberDiv = document.getElementById("wave-number");
waveLabelDiv = document.getElementById("wave-label");
skeletonCanvas = document.getElementById("skeleton-canvas");

// ✅ 安全检查：确保canvas存在
if (skeletonCanvas) {
    skeletonCtx = skeletonCanvas.getContext("2d");
} else {
    console.warn("⚠️ Skeleton canvas not found");
}

// helper: keep the video and skeleton canvas visually the same size
function syncComparisonSizes() {
    const vid = document.getElementById('zombie-video');
    if (!vid || !skeletonCanvas) return;
    // Use the video's layout size (clientWidth/clientHeight) as the display size
    // and the video's natural resolution (videoWidth/videoHeight) as the canvas pixel buffer
    let displayWidth = vid.clientWidth || Math.floor(window.innerWidth * 0.3);
    let displayHeight = vid.clientHeight || Math.floor(window.innerHeight * 0.2);

    // If the video has metadata, prefer using its aspect ratio and cap to available width
    if (vid.videoWidth && vid.videoHeight) {
        const aspect = vid.videoWidth / vid.videoHeight;
        // cap width to 45% of viewport width so both can fit side-by-side comfortably
        const maxWidth = Math.floor(window.innerWidth * 0.45 - 40);
        displayWidth = Math.min(maxWidth, vid.videoWidth);
        displayHeight = Math.round(displayWidth / aspect);
    }

    // Apply style size to both elements, and set the canvas pixel size to the video's source resolution
    vid.style.width = displayWidth + 'px';
    vid.style.height = displayHeight + 'px';
    skeletonCanvas.style.width = displayWidth + 'px';
    skeletonCanvas.style.height = displayHeight + 'px';

    // set the canvas internal pixel dimensions for crisp drawing
    const targetBufferW = vid.videoWidth || displayWidth;
    const targetBufferH = vid.videoHeight || displayHeight;
    if (skeletonCanvas.width !== targetBufferW || skeletonCanvas.height !== targetBufferH) {
        skeletonCanvas.width = targetBufferW;
        skeletonCanvas.height = targetBufferH;
    }
}

// When the video metadata is loaded, sync sizes.
const compVid = document.getElementById('zombie-video');
if (compVid) {
    compVid.addEventListener('loadedmetadata', () => {
        syncComparisonSizes();
    });
    compVid.addEventListener('playing', () => {
        syncComparisonSizes();
    });
}

// ==================== UI更新函数 ====================
function updateUI() {
    goldDisplayDiv.textContent = playerGold;
    zombieCountDiv.textContent = zombies.length;
    heliCountDiv.textContent = helicopters.length;
    killCountDiv.textContent = totalKills;
    healthDisplayDiv.textContent = `${baseHealth}/5`;
    
    // 健康值颜色
    healthDisplayDiv.classList.remove('danger', 'warning');
    if (baseHealth <= 2) {
        healthDisplayDiv.classList.add('danger');
    } else if (baseHealth <= 3) {
        healthDisplayDiv.classList.add('warning');
    }
    
    // 波次信息
    waveNumberDiv.textContent = `WAVE ${currentWave}`;
    waveLabelDiv.textContent = `Difficulty: x${zombieSpeedMultiplier.toFixed(1)}`;
    
    // 商店按钮状态
    const buyHeliButton = document.getElementById('buy-helicopter');
    if (playerGold >= HELI_PRICE) {
        buyHeliButton.classList.remove('disabled');
    } else {
        buyHeliButton.classList.add('disabled');
    }
}

// ==================== 购买提示 ====================
function showPurchaseNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'purchase-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 1500);
}

// ==================== 购买直升机 ====================
function buyHelicopter() {
    if (playerGold < HELI_PRICE) {
        showPurchaseNotification('❌ Not enough gold!');
        return;
    }
    
    if (helipads.length === 0) {
        showPurchaseNotification('❌ No helipads available!');
        return;
    }
    
    // 找到一个空闲停机坪
    let availablePad = null;
    for (const pad of helipads) {
        let occupied = false;
        for (const heli of helicopters) {
            const heliPos = new T.Vector3();
            heli.objects[0].getWorldPosition(heliPos);
            const padPos = new T.Vector3(pad.x, 0, pad.z);
            if (heliPos.distanceTo(padPos) < 2) {
                occupied = true;
                break;
            }
        }
        if (!occupied) {
            availablePad = pad;
            break;
        }
    }
    
    if (!availablePad) {
        showPurchaseNotification('❌ All helipads occupied!');
        return;
    }
    
    // 扣除金币
    playerGold -= HELI_PRICE;
    
    // 创建直升机
    const colors = [0x2194ce, 0x21ce94, 0xce2194, 0xce9421, 0x9421ce];
    const color = colors[helicopters.length % colors.length];
    
    const heli = new DetailedHelicopter({
        x: availablePad.x,
        y: 0,
        z: availablePad.z,
        scale: 1,
        color: color,
        altitude: 5 + helicopters.length * 0.5
    });
    
    world.add(heli);
    helicopters.push(heli);
    heli.getPads(helipads);
    
    updateUI();
    showPurchaseNotification('✅ Helicopter deployed!');
    console.log(`✓ Helicopter purchased! Gold: ${playerGold}`);
}

// 绑定购买按钮
document.getElementById('buy-helicopter').addEventListener('click', buyHelicopter);

// ==================== 波次系统 ====================
function updateWaveSystem() {
    const now = Date.now();
    const elapsed = now - lastWaveTime;
    
    // 每60秒（1分钟）增加难度
    if (elapsed >= 60000) {
        currentWave++;
        zombieSpeedMultiplier *= 2.0; // 速度翻倍
        spawnInterval = Math.max(1000, spawnInterval * 0.8); // 生成速度加快
        lastWaveTime = now;
        
        // 重启生成定时器
        if (zombieSpawnTimer) {
            clearInterval(zombieSpawnTimer);
        }
        zombieSpawnTimer = setInterval(() => {
            if (!gameOver) {
                spawnZombie();
            }
        }, spawnInterval);
        
        console.log(`🌊 WAVE ${currentWave}! Speed: x${zombieSpeedMultiplier.toFixed(1)}, Spawn interval: ${spawnInterval}ms`);
        showPurchaseNotification(`🌊 WAVE ${currentWave} - Difficulty Increased!`);
    }
}

// ==================== 添加光照 ====================
const ambientLight = new T.AmbientLight(0x404040, 0.5);
world.scene.add(ambientLight);

const directionalLight1 = new T.DirectionalLight(0xffffff, 0.8);
directionalLight1.position.set(10, 20, 10);
directionalLight1.castShadow = true;
world.scene.add(directionalLight1);

const directionalLight2 = new T.DirectionalLight(0x8888ff, 0.3);
directionalLight2.position.set(-10, 10, -10);
world.scene.add(directionalLight2);

const moonLight = new T.DirectionalLight(0xaaaaff, 0.2);
moonLight.position.set(0, 30, 0);
world.scene.add(moonLight);

// ==================== 创建高科技基地 ====================
function createBase() {
    const baseGroup = new T.Group();
    
    const baseGeometry = new T.CylinderGeometry(2.5, 2.8, 1.5, 6);
    const baseMaterial = new T.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0x0066ff,
        emissiveIntensity: 0.1
    });
    const baseMesh = new T.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = 0.75;
    baseGroup.add(baseMesh);
    
    const shieldRingGeo = new T.TorusGeometry(2.3, 0.15, 16, 32);
    const shieldMaterial = new T.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        metalness: 0.8,
        roughness: 0.2,
        transparent: true,
        opacity: 0.6
    });
    const shieldRing = new T.Mesh(shieldRingGeo, shieldMaterial);
    shieldRing.position.y = 1.5;
    shieldRing.rotation.x = Math.PI / 2;
    baseGroup.add(shieldRing);
    
    const antennaGeo = new T.CylinderGeometry(0.1, 0.15, 2, 8);
    const antennaMaterial = new T.MeshStandardMaterial({
        color: 0x666666,
        metalness: 0.8,
        roughness: 0.3
    });
    const antenna = new T.Mesh(antennaGeo, antennaMaterial);
    antenna.position.y = 2.5;
    baseGroup.add(antenna);
    
    const signalLightGeo = new T.SphereGeometry(0.2, 16, 16);
    const signalMaterial = new T.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1.5
    });
    const signalLight = new T.Mesh(signalLightGeo, signalMaterial);
    signalLight.position.y = 3.5;
    baseGroup.add(signalLight);
    
    const windowGeometry = new T.BoxGeometry(0.6, 0.8, 0.1);
    const windowMaterial = new T.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7
    });
    
    for (let i = 0; i < 6; i++) {
        const window = new T.Mesh(windowGeometry, windowMaterial);
        const angle = (i / 6) * Math.PI * 2;
        window.position.set(
            Math.sin(angle) * 2.5,
            1,
            Math.cos(angle) * 2.5
        );
        window.lookAt(0, 1, 0);
        baseGroup.add(window);
    }
    
    const panelGeo = new T.BoxGeometry(0.5, 0.3, 0.05);
    const panelMaterial = new T.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.9,
        roughness: 0.1
    });
    
    for (let i = 0; i < 6; i++) {
        const panel = new T.Mesh(panelGeo, panelMaterial);
        const angle = (i / 6) * Math.PI * 2;
        panel.position.set(
            Math.sin(angle) * 2.2,
            0.3,
            Math.cos(angle) * 2.2
        );
        panel.lookAt(0, 0.3, 0);
        baseGroup.add(panel);
    }
    
    baseGroup.position.set(0, 0, 0);
    world.scene.add(baseGroup);
    
    console.log("✓ Base created at (0, 0, 0)");
    return baseGroup;
}

baseObject = createBase();

// Create two straight roads from the top border and bottom border into the base
function createRoad(fromX, fromZ, toX = 0, toZ = 0, width = 2.0, color = 0x222222) {
    const start = new T.Vector3(fromX, 0, fromZ);
    const end = new T.Vector3(toX, 0, toZ);
    const dir = new T.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 0.001) return;

    // road as a flat box (width x thin height x length), center it in the middle
    const geo = new T.BoxGeometry(width, 0.02, length);
    const mat = new T.MeshStandardMaterial({ color: color, roughness: 0.9, metalness: 0.05 });
    const road = new T.Mesh(geo, mat);
    // rotate road to align with direction (box length along Z by default)
    // Place the road midpoint at start + dir*0.5
    const mid = new T.Vector3().addVectors(start, dir.multiplyScalar(0.5));
    road.position.copy(mid);
    // rotate it so its local z aligns with the world dir (don't change y)
    // compute quaternion from z-axis (0,0,1) to dir normalized in XZ plane
    const dirXZ = new T.Vector3(dir.x, 0, dir.z).normalize();
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), dirXZ);
    road.quaternion.copy(q);
    // lift slightly above ground: ground is y=0 plane with base at y ~0.0
    road.position.y = 0.01;
    world.scene.add(road);
    // add a center stripe
    const stripeGeo = new T.BoxGeometry(Math.max(0.08, width * 0.06), 0.005, length);
    const stripeMat = new T.MeshStandardMaterial({ color: 0xffff66, emissive: 0xffff66, emissiveIntensity: 0.3 });
    const stripe = new T.Mesh(stripeGeo, stripeMat);
    stripe.position.copy(mid);
    stripe.position.y = 0.021; // slightly above road so it's visible
    stripe.quaternion.copy(q);
    world.scene.add(stripe);
    return road;
}

// Build two roads: top and bottom along the Z-axis to base
createRoad(0, SPAWN_DISTANCE * 2, 0, 0, 3.2, 0x333333); // bottom to base (extended)
createRoad(0, -SPAWN_DISTANCE * 2, 0, 0, 3.2, 0x333333); // top to base (extended)

// ==================== 创建高科技炮台 ====================
function createTurret() {
    const turretGroup = new T.Group();
    
    const baseGeo = new T.CylinderGeometry(0.5, 0.6, 0.3, 8);
    const baseMaterial = new T.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.2
    });
    const base = new T.Mesh(baseGeo, baseMaterial);
    base.position.y = 1.65;
    turretGroup.add(base);
    
    turretGroup.rotator = new T.Group();
    turretGroup.rotator.position.y = 1.8;
    turretGroup.add(turretGroup.rotator);
    
    const barrelGeo = new T.CylinderGeometry(0.15, 0.12, 1.2, 12);
    const barrelMaterial = new T.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.95,
        roughness: 0.1
    });
    const barrel = new T.Mesh(barrelGeo, barrelMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.6, 0, 0);
    turretGroup.rotator.add(barrel);
    
    const muzzleGeo = new T.CylinderGeometry(0.18, 0.15, 0.1, 12);
    const muzzle = new T.Mesh(muzzleGeo, barrelMaterial);
    muzzle.rotation.z = Math.PI / 2;
    muzzle.position.set(1.2, 0, 0);
    turretGroup.rotator.add(muzzle);
    
    const turretBodyGeo = new T.BoxGeometry(0.6, 0.4, 0.6);
    const turretBody = new T.Mesh(turretBodyGeo, baseMaterial);
    turretGroup.rotator.add(turretBody);
    
    const laserGeo = new T.CylinderGeometry(0.02, 0.02, 10, 8);
    const laserMaterial = new T.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.5
    });
    turretGroup.laser = new T.Mesh(laserGeo, laserMaterial);
    turretGroup.laser.rotation.z = Math.PI / 2;
    turretGroup.laser.position.set(6.2, 0, 0);
    turretGroup.laser.visible = false;
    turretGroup.rotator.add(turretGroup.laser);
    
    turretGroup.position.set(0, 0, 0);
    turretGroup.target = null;
    turretGroup.targetZombie = null;
    turretGroup.fireTimer = 0;
    
    world.scene.add(turretGroup);
    console.log("✓ Turret created");
    return turretGroup;
}

turret = createTurret();

// ==================== 创建爱心显示 ====================
function createHearts() {
    const heartGroup = new T.Group();
    
    for (let i = 0; i < 5; i++) {
        const heartShape = new T.Shape();
        const x = 0, y = 0;
        
        heartShape.moveTo(x, y);
        heartShape.bezierCurveTo(x, y - 0.3, x - 0.5, y - 0.3, x - 0.5, y);
        heartShape.bezierCurveTo(x - 0.5, y + 0.3, x, y + 0.5, x, y + 0.8);
        heartShape.bezierCurveTo(x, y + 0.5, x + 0.5, y + 0.3, x + 0.5, y);
        heartShape.bezierCurveTo(x + 0.5, y - 0.3, x, y - 0.3, x, y);
        
        const extrudeSettings = {
            depth: 0.1,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.05,
            bevelSegments: 3
        };
        
        const heartGeometry = new T.ExtrudeGeometry(heartShape, extrudeSettings);
        const heartMaterial = new T.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5,
            metalness: 0.3,
            roughness: 0.5
        });
        
        const heart = new T.Mesh(heartGeometry, heartMaterial);
        heart.rotation.z = Math.PI;
        heart.position.set(-4 + i * 0.8, 3.5, 3.5);
        heart.scale.set(0.3, 0.3, 0.3);
        
        heartGroup.add(heart);
        hearts.push(heart);
    }
    
    world.scene.add(heartGroup);
    console.log("✓ Hearts created:", hearts.length);
}

createHearts();

// ==================== 创建停机坪 ====================
const helipad1 = new Helipad(-12, 0, -22);
const helipad2 = new Helipad(12, 0, -22);
const helipad3 = new Helipad(-12, 0, 22);
const helipad4 = new Helipad(12, 0, 22);


helipads = [helipad1, helipad2, helipad3, helipad4,];

world.add(helipad1);
world.add(helipad2);
world.add(helipad3);
world.add(helipad4);


// 初始没有直升机
console.log("✓ Helipads created: 5, Helicopters: 0");



// ==================== 骨骼绘制函数 ====================
const POSE_CONNECTIONS = [
    [11, 12], [11, 23], [12, 24], [23, 24],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [23, 25], [25, 27],
    [24, 26], [26, 28]
];

function drawSkeleton(pose) {
    skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
    
    if (!pose || !pose.keypoints) return;
    
    const keypoints = pose.keypoints;
    // helper to find keypoint by name (name/part/label or fallback to indices)
    const findKeypointByName = (name) => {
        if (!keypoints) return null;
        for (let i = 0; i < keypoints.length; i++) {
            const k = keypoints[i];
            if (!k) continue;
            if (k.name === name || k.part === name || k.label === name) return k;
        }
        return null;
    };

    const get2DPosBy = (name, blazeIndex, moveIndex) => {
        let p = findKeypointByName(name);
        if (!p) {
            const modelType = typeof getPoseModelType === 'function' ? getPoseModelType() : 'blazepose';
            const idx = (modelType === 'movenet' ? moveIndex : blazeIndex);
            p = keypoints[idx];
        }
        if (!p || (typeof p.score === 'number' && p.score < 0.3)) return null;
        return { x: p.x, y: p.y };
    };
    const scaleX = skeletonCanvas.width / (document.getElementById('zombie-video').videoWidth || 640);
    const scaleY = skeletonCanvas.height / (document.getElementById('zombie-video').videoHeight || 480);
    
    skeletonCtx.strokeStyle = '#44ff44';
    skeletonCtx.lineWidth = 3;
    skeletonCtx.lineCap = 'round';
    
    // Draw connections using name-based mapping with BlazePose and MoveNet fallback indices
    const DRAW_CONNECTIONS = [
        ['left_shoulder', 11, 5, 'right_shoulder', 12, 6],
        ['left_shoulder', 11, 5, 'left_hip', 23, 11],
        ['right_shoulder', 12, 6, 'right_hip', 24, 12],
        ['left_shoulder', 11, 5, 'left_elbow', 13, 7],
        ['left_elbow', 13, 7, 'left_wrist', 15, 9],
        ['right_shoulder', 12, 6, 'right_elbow', 14, 8],
        ['right_elbow', 14, 8, 'right_wrist', 16, 10],
        ['left_hip', 23, 11, 'left_knee', 25, 13],
        ['left_knee', 25, 13, 'left_ankle', 27, 15],
        ['right_hip', 24, 12, 'right_knee', 26, 14],
        ['right_knee', 26, 14, 'right_ankle', 28, 16]
    ];

    for (const c of DRAW_CONNECTIONS) {
        const [nameA, bA, mA, nameB, bB, mB] = c;
        const A = get2DPosBy(nameA, bA, mA);
        const B = get2DPosBy(nameB, bB, mB);
        if (A && B) {
            skeletonCtx.beginPath();
            skeletonCtx.moveTo(A.x * scaleX, A.y * scaleY);
            skeletonCtx.lineTo(B.x * scaleX, B.y * scaleY);
            skeletonCtx.stroke();
        }
    }
    
    // draw keypoints by name with common set for neck/shoulders/hips/limbs
    const DRAW_KEYPOINTS = [
        ['nose', 0, 0], ['left_eye', 1, 1], ['right_eye', 2, 2],
        ['left_shoulder', 11, 5], ['right_shoulder', 12, 6],
        ['left_elbow', 13, 7], ['right_elbow', 14, 8],
        ['left_wrist', 15, 9], ['right_wrist', 16, 10],
        ['left_hip', 23, 11], ['right_hip', 24, 12],
        ['left_knee', 25, 13], ['right_knee', 26, 14],
        ['left_ankle', 27, 15], ['right_ankle', 28, 16]
    ];

    for (const k of DRAW_KEYPOINTS) {
        const [name, bIdx, mIdx] = k;
        const p = get2DPosBy(name, bIdx, mIdx);
        if (p) {
            const x = p.x * scaleX;
            const y = p.y * scaleY;
            
            skeletonCtx.fillStyle = '#ffffff';
            skeletonCtx.beginPath();
            skeletonCtx.arc(x, y, 5, 0, 2 * Math.PI);
            skeletonCtx.fill();
            
            skeletonCtx.fillStyle = '#44ff44';
            skeletonCtx.beginPath();
            skeletonCtx.arc(x, y, 3, 0, 2 * Math.PI);
            skeletonCtx.fill();
        }
    }
}

// ==================== 姿态检测循环 ====================
async function poseDetectionLoop() {
    const video = document.getElementById('zombie-video');
    
    if (!sharedDetector || !video.videoWidth) {
        requestAnimationFrame(poseDetectionLoop);
        return;
    }
    
    try {
        const poses = await sharedDetector.estimatePoses(video, { flipHorizontal: false });
        
        if (poses && poses.length > 0) {
            const pose = poses[0];
            drawSkeleton(pose);
            
            zombies.forEach(zombie => {
                zombie.applyPoseToModel(pose);
            });
        }
    } catch (error) {
        console.error('Pose detection error:', error);
    }
    
    requestAnimationFrame(poseDetectionLoop);
}

// ==================== 丧尸生成函数 ====================
function spawnZombie() {
    if (gameOver) return;
    const zombieVideo = document.getElementById('zombie-video');
    if (!zombieVideo) return;

    // Spawn only from top OR bottom border center (with small X jitter)
    const spawnAtTop = Math.random() < 0.5; // choose one of the two
    const jitterX = (Math.random() - 0.5) * 1.6; // small side offset for lanes
    const radius = SPAWN_DISTANCE + Math.random() * 3;
    const sx = jitterX; // center is zero X for top/bottom
    const sz = spawnAtTop ? -radius : radius; // top is negative z (by convention)

    const zombie = new Zombie({
        x: sx,
        z: sz,
        video: zombieVideo,
        speed: (0.0015 + Math.random() * 0.001) * zombieSpeedMultiplier,
        health: ZOMBIE_BASE_HEALTH
    });
    
    world.add(zombie);
    zombies.push(zombie);
    updateUI();
    
    console.log(`🧟 Zombie spawned at (${sx.toFixed(1)}, ${sz.toFixed(1)}), health: ${zombie.health}`);
}

// ==================== 子弹系统 ====================
function createBullet(startPos, endPos, color = 0xffff00) {
    const direction = new T.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    
    const bulletGeo = new T.CylinderGeometry(0.05, 0.05, distance, 8);
    const bulletMaterial = new T.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.8
    });
    
    const bullet = new T.Mesh(bulletGeo, bulletMaterial);
    bullet.position.copy(startPos).add(direction.multiplyScalar(0.5));
    bullet.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        direction.normalize()
    );
    
    bullet.lifetime = 8;
    world.scene.add(bullet);
    bullets.push(bullet);
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.lifetime--;
        bullet.material.opacity = bullet.lifetime / 8;
        
        if (bullet.lifetime <= 0) {
            world.scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }
}

// ==================== 枪口火焰 ====================
function createMuzzleFlash(position) {
    const flashGeo = new T.SphereGeometry(0.3, 8, 8);
    const flashMaterial = new T.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xffaa00,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 1.0
    });
    
    const flash = new T.Mesh(flashGeo, flashMaterial);
    flash.position.copy(position);
    flash.lifetime = 5;
    
    world.scene.add(flash);
    muzzleFlashes.push(flash);
}

function updateMuzzleFlashes() {
    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        const flash = muzzleFlashes[i];
        flash.lifetime--;
        flash.material.opacity = flash.lifetime / 5;
        flash.scale.multiplyScalar(1.2);
        
        if (flash.lifetime <= 0) {
            world.scene.remove(flash);
            muzzleFlashes.splice(i, 1);
        }
    }
}

// ==================== 炮台攻击系统 ====================
function turretAttack() {
    if (!turret.targetZombie || gameOver) {
        if (turret.fireTimer > 0) {
            turret.fireTimer = 0;
        }
        return;
    }
    
    if (!turret.targetZombie.isAlive || !turret.targetZombie.isAlive()) {
        turret.targetZombie = null;
        turret.target = null;
        turret.laser.visible = false;
        turret.fireTimer = 0;
        return;
    }
    
    turret.fireTimer++;
    
    if (turret.fireTimer >= 30) {
        turret.fireTimer = 0;
        
        const muzzlePos = new T.Vector3(1.2, 1.8, 0);
        turret.rotator.localToWorld(muzzlePos);
        
        const targetPos = new T.Vector3();
        turret.targetZombie.group.getWorldPosition(targetPos);
        targetPos.y += 1;
        
        createBullet(muzzlePos, targetPos, 0xffff00);
        createMuzzleFlash(muzzlePos);
        
        console.log(`🔫 TURRET FIRING at zombie, health before: ${turret.targetZombie.health}`);
        const died = turret.targetZombie.takeDamage(TURRET_DAMAGE);
        console.log(`   Health after: ${turret.targetZombie.health}, died: ${died}`);
        
        if (died) {
            console.log("💀 Zombie killed by turret!");
            const zombieIndex = zombies.indexOf(turret.targetZombie);
            if (zombieIndex !== -1) {
                // ✅ 修复：使用 world.scene.remove
                world.scene.remove(zombies[zombieIndex].group);
                zombies.splice(zombieIndex, 1);
                
                // 奖励金币
                playerGold += ZOMBIE_GOLD_REWARD;
                totalKills++;
                updateUI();
                console.log(`💰 +${ZOMBIE_GOLD_REWARD} gold! Total: ${playerGold}`);
            }
            turret.targetZombie = null;
            turret.target = null;
            turret.laser.visible = false;
        }
    }
}

// ==================== 炮台瞄准 ====================
function updateTurret() {
    if (gameOver) return;
    
    let closestZombie = null;
    let closestZombieObj = null;
    let minDistance = 20;
    
    const turretPos = new T.Vector3(0, 1.8, 0);
    
    for (const zombie of zombies) {
        if (!zombie.isAlive || !zombie.isAlive()) continue;
        
        const zombiePos = new T.Vector3();
        zombie.group.getWorldPosition(zombiePos);
        const distance = turretPos.distanceTo(zombiePos);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestZombie = zombie.group;
            closestZombieObj = zombie;
        }
    }
    
    turret.target = closestZombie;
    turret.targetZombie = closestZombieObj;
    
    if (closestZombie) {
        const targetPos = new T.Vector3();
        closestZombie.getWorldPosition(targetPos);
        
        const dx = targetPos.x - turretPos.x;
        const dz = targetPos.z - turretPos.z;
        const targetAngle = Math.atan2(dx, dz);
        
        turret.rotator.rotation.y = targetAngle;
        turret.laser.visible = true;
        
        console.log(`🎯 Turret locked on zombie at distance ${minDistance.toFixed(2)}m, health: ${closestZombieObj.health}`);
    } else {
        turret.laser.visible = false;
        turret.fireTimer = 0;
    }
}

// ==================== 直升机攻击系统 ====================
let heliAttackTimers = [];

function helicopterAttack() {
    if (gameOver) return;
    
    helicopters.forEach((heli, index) => {
        if (!heliAttackTimers[index]) heliAttackTimers[index] = 0;
        
        if (heli.gunTarget) {
            let targetZombie = null;
            for (const zombie of zombies) {
                if (zombie.group === heli.gunTarget) {
                    targetZombie = zombie;
                    break;
                }
            }
            
            if (targetZombie && targetZombie.isAlive && targetZombie.isAlive()) {
                heliAttackTimers[index]++;
                
                if (heliAttackTimers[index] >= 20) {
                    heliAttackTimers[index] = 0;
                    
                    const gunPos = new T.Vector3();
                    heli.gunRotator.getWorldPosition(gunPos);
                    
                    const targetPos = new T.Vector3();
                    targetZombie.group.getWorldPosition(targetPos);
                    targetPos.y += 1;
                    
                    createBullet(gunPos, targetPos, 0xff8800);
                    createMuzzleFlash(gunPos);
                    
                    console.log(`✈️ HELI ${index} FIRING at zombie, health before: ${targetZombie.health}`);
                    const died = targetZombie.takeDamage(HELI_DAMAGE);
                    console.log(`   Health after: ${targetZombie.health}, died: ${died}`);
                    
                    if (died) {
                        console.log(`💀 Zombie killed by heli ${index}!`);
                        const zombieIndex = zombies.indexOf(targetZombie);
                        if (zombieIndex !== -1) {
                            // ✅ 修复：使用 world.scene.remove
                            world.scene.remove(zombies[zombieIndex].group);
                            zombies.splice(zombieIndex, 1);
                            
                            playerGold += ZOMBIE_GOLD_REWARD;
                            totalKills++;
                            updateUI();
                            console.log(`💰 +${ZOMBIE_GOLD_REWARD} gold! Total: ${playerGold}`);
                        }
                        heli.gunTarget = null;
                        heli.spotlightTarget = null;
                    }
                }
            } else {
                heliAttackTimers[index] = 0;
                heli.gunTarget = null;
                heli.spotlightTarget = null;
            }
        } else {
            heliAttackTimers[index] = 0;
        }
    });
}

// ==================== 基地碰撞检测 ====================
function checkBaseCollisions() {
    if (gameOver) return;
    
    const basePos = new T.Vector3(0, 0, 0);
    
    for (let i = zombies.length - 1; i >= 0; i--) {
        const zombie = zombies[i];
        
        if (!zombie.isAlive || !zombie.isAlive()) continue;
        
        const zombiePos = new T.Vector3();
        zombie.group.getWorldPosition(zombiePos);
        
        const distance = basePos.distanceTo(zombiePos);
        
        // Debug: 每秒打印一次距离（仅当距离<10米时）
        if (debugFrameCount % 60 === 0 && distance < 10) {
            console.log(`🧟 Zombie ${i} distance to base: ${distance.toFixed(2)}m (threshold: ${BASE_RADIUS}m)`);
        }
        
        if (distance < BASE_RADIUS) {
            console.log(`💥 ZOMBIE HIT BASE! Distance: ${distance.toFixed(2)}m`);
            
            // ✅ 修复：使用 world.scene.remove
            world.scene.remove(zombie.group);
            zombies.splice(i, 1);
            
            baseHealth--;
            console.log(`❤️  Base health: ${baseHealth}/5`);
            
            if (hearts[baseHealth]) {
                hearts[baseHealth].visible = false;
                console.log(`   Heart ${baseHealth} hidden`);
            }
            
            updateUI();
            
            if (baseHealth <= 0) {
                gameOver = true;
                showGameOver();
            }
        }
    }
}

// ==================== 游戏结束 ====================
function showGameOver() {
    const gameOverScreen = document.getElementById('game-over-screen');
    document.getElementById('final-wave').textContent = currentWave;
    document.getElementById('final-kills').textContent = totalKills;
    document.getElementById('final-gold').textContent = playerGold;
    gameOverScreen.classList.add('show');
    
    console.log("💀💀💀 GAME OVER 💀💀💀");
}

// 重启按钮
document.getElementById('restart-button').addEventListener('click', () => {
    location.reload();
});

// ==================== 清理死亡丧尸 ====================
function cleanupDeadZombies() {
    let removed = 0;
    for (let i = zombies.length - 1; i >= 0; i--) {
        if (!zombies[i].isAlive || !zombies[i].isAlive()) {
            // ✅ 修复：使用 world.scene.remove
            world.scene.remove(zombies[i].group);
            zombies.splice(i, 1);
            removed++;
        }
    }
    if (removed > 0) {
        updateUI();
    }
}

// ==================== 初始化丧尸系统 ====================
let zombiesInitialized = false;

async function initZombies() {
    const zombieVideo = document.getElementById('zombie-video');
    
    if (!zombieVideo || !zombieVideo.videoWidth) {
        setTimeout(initZombies, 500);
        return;
    }
    
    if (typeof poseDetection === 'undefined') {
        setTimeout(initZombies, 500);
        return;
    }
    
    statusDiv.textContent = "Initializing...";
    
    try {
        sharedDetector = await initSharedDetector();
        console.log('Pose detection model in use:', getPoseModelType());

        // Show and size the comparison video and skeleton canvas
        if (skeletonCanvas) {
            skeletonCanvas.style.display = 'block';
        }
        if (zombieVideo) {
            try { zombieVideo.play(); } catch(e) { console.warn('Video play blocked:', e); }
            // display the small preview (css): ensure it's visible
            zombieVideo.style.display = 'block';
            // ensure the canvas pixel size and styles match the video display
            syncComparisonSizes();
        }
        
        // 初始生成2个丧尸
        for (let i = 0; i < 2; i++) {
            spawnZombie();
        }
        
        zombiesInitialized = true;
        statusDiv.textContent = "Online ✓";
        console.log(`✓ Zombie system initialized`);
        
        poseDetectionLoop();
        
        // 启动生成定时器
        zombieSpawnTimer = setInterval(() => {
            if (!gameOver) {
                spawnZombie();
            }
        }, spawnInterval);
        
        updateUI();
        
    } catch (error) {
        console.error("Failed to initialize:", error);
        statusDiv.textContent = "Failed";
    }
}

initZombies();

// ==================== 目标检测和锁定系统 ====================
let lockUpdateTimer = 0;

function updateTargetLocking() {
    lockUpdateTimer++;
    
    if (lockUpdateTimer < 30) return;
    lockUpdateTimer = 0;
    
    helicopters.forEach((heli) => {
        heli.detectTargets(zombies, 15);
    });
}

// ==================== 主更新循环 ====================
function updateLoop() {
    debugFrameCount++;
    
    if (zombiesInitialized && !gameOver) {
        updateTargetLocking();
        checkBaseCollisions();
        updateTurret();
        turretAttack();
        helicopterAttack();
        updateMuzzleFlashes();
        updateBullets();
        cleanupDeadZombies();
        updateWaveSystem();
    }
    
    // Debug状态报告（每5秒）
    const now = Date.now();
    if (now - lastDebugTime > 5000) {
        console.log("\n=== STATUS REPORT ===");
        console.log(`Zombies alive: ${zombies.length}`);
        console.log(`Base health: ${baseHealth}/5`);
        console.log(`Game over: ${gameOver}`);
        console.log(`Turret target: ${turret.targetZombie ? 'YES' : 'NO'}`);
        console.log(`Bullets active: ${bullets.length}`);
        console.log(`Frame count: ${debugFrameCount}`);
        console.log("====================\n");
        lastDebugTime = now;
    }
    
    requestAnimationFrame(updateLoop);
}

// ==================== 相机设置 ====================
// restore default camera height
world.camera.position.set(0, 25, 35);
world.camera.lookAt(0, 0, 0);
// restore solo camera to default position
world.solo_camera.position.set(1, 1, 1);

// ==================== 启动世界 ====================
world.go();
updateLoop();
updateUI();

console.log("=== ZOMBIE DEFENSE INITIALIZED ===");
console.log("Gold:", playerGold);
console.log("Helicopters:", helicopters.length);
console.log("Zombie Health:", ZOMBIE_BASE_HEALTH);
console.log("Kill Reward:", ZOMBIE_GOLD_REWARD);
console.log("Heli Price:", HELI_PRICE);