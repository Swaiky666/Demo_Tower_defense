/*jshint esversion: 6 */
// @ts-check

import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import * as T from "../libs/CS559-Three/build/three.module.js";
import { DetailedHelicopter, Helipad } from "./DetailedHelicopter.js";
import { Zombie, initSharedDetector, getPoseModelType } from "./Zombie.js";
import { ArmoredVehicle } from "./Armoredvehicle.js";
import { GameModels } from "./GameModels.js";
import { CombatManager } from "./CombatManager.js";

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

// 装甲战车
let armoredVehicle = null;

// 游戏状态
let baseHealth = 5;
let gameOver = false;
let baseObject;
let hearts = [];
let turret;

// 战斗管理器
let combatManager = null;

// 经济系统
let playerGold = 500;
let totalKills = 0;
let currentWave = 1;
let spawnInterval = 5000;
let zombieSpeedMultiplier = 1.0;

// 基地参数
const BASE_RADIUS = 2.8;
const TURRET_DAMAGE = 50;
const HELI_DAMAGE = 30;
const ZOMBIE_BASE_HEALTH = 1000;
const ZOMBIE_GOLD_REWARD = 30;
const HELI_PRICE = 500;
const SPAWN_DISTANCE = 22;

// DEBUG计数器
let debugFrameCount = 0;
let lastDebugTime = Date.now();
let lastWaveTime = Date.now();
let zombieSpawnTimer = null;
let zombiesInitialized = false;

// 键盘控制
let keys = {};

// ==================== 初始化世界 ====================
world = new GrWorld({
    groundplanecolor: "#2a4d2a",
    groundplanesize: 50,
    width: window.innerWidth,
    height: window.innerHeight * 2,
    where: document.getElementById("div1")
});

// ==================== 窗口调整 ====================
function syncComparisonSizes() {
    const video = document.getElementById('zombie-video');
    const canvas = document.getElementById('skeleton-canvas');
    if (video && canvas) {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        const aspectRatio = w / h;
        const displayHeight = 150;
        const displayWidth = displayHeight * aspectRatio;
        video.style.width = `${displayWidth}px`;
        video.style.height = `${displayHeight}px`;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
    }
}

function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (world && world.renderer && world.camera) {
        world.renderer.setSize(w, h, false);
        if (world.renderer.domElement) {
            world.renderer.domElement.style.width = `100%`;
            world.renderer.domElement.style.height = `100%`;
        }
        world.camera.aspect = w / h;
        world.camera.updateProjectionMatrix();
        if (world.solo_camera) {
            world.solo_camera.aspect = w / h;
            world.solo_camera.updateProjectionMatrix();
        }
    }
    syncComparisonSizes();
}
window.addEventListener('resize', onWindowResize);
onWindowResize();

// ==================== 键盘控制 ====================
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// ==================== 获取UI元素 ====================
statusDiv = document.getElementById("status");
zombieCountDiv = document.getElementById("zombie-count");
heliCountDiv = document.getElementById("heli-count");
killCountDiv = document.getElementById("kill-count");
goldDisplayDiv = document.getElementById("gold-display");
healthDisplayDiv = document.getElementById("health-display");
waveNumberDiv = document.getElementById("wave-number");
waveLabelDiv = document.getElementById("wave-label");
skeletonCanvas = document.getElementById('skeleton-canvas');
skeletonCtx = skeletonCanvas.getContext('2d');

// ==================== UI更新 ====================
function updateUI() {
    if (combatManager) {
        totalKills = combatManager.getTotalKills();
        playerGold = combatManager.getPlayerGold();
    }

    if (zombieCountDiv) zombieCountDiv.textContent = zombies.length;
    if (heliCountDiv) heliCountDiv.textContent = helicopters.length;
    if (killCountDiv) killCountDiv.textContent = totalKills;
    if (goldDisplayDiv) goldDisplayDiv.textContent = playerGold;
    if (healthDisplayDiv) healthDisplayDiv.textContent = baseHealth;
    if (waveNumberDiv) waveNumberDiv.textContent = currentWave;
    if (waveLabelDiv) waveLabelDiv.textContent = `Difficulty: x${zombieSpeedMultiplier.toFixed(1)}`;

    const buyButton = document.getElementById('buy-helicopter');
    if (buyButton) {
        if (playerGold < HELI_PRICE) {
            buyButton.classList.add('disabled');
        } else {
            buyButton.classList.remove('disabled');
        }
    }
}

// ==================== 购买提示 ====================
function showPurchaseNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'message';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// ==================== 游戏结束 ====================
function showGameOver() {
    gameOver = true;
    console.log("💀 GAME OVER! 💀");

    document.getElementById('final-wave').textContent = currentWave;
    document.getElementById('final-kills').textContent = totalKills;
    document.getElementById('final-gold').textContent = playerGold;

    const gameOverScreen = document.getElementById('game-over-screen');
    gameOverScreen.classList.add('show');

    if (zombieSpawnTimer) {
        clearInterval(zombieSpawnTimer);
    }
}

// ==================== 重启游戏 ====================
document.getElementById('restart-button').addEventListener('click', () => {
    location.reload();
});

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

    playerGold -= HELI_PRICE;
    if (combatManager) {
        combatManager.setPlayerGold(playerGold);
    }

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

document.getElementById('buy-helicopter').addEventListener('click', buyHelicopter);

// ==================== 波次系统 ====================
function updateWaveSystem() {
    const now = Date.now();
    const elapsed = now - lastWaveTime;

    if (elapsed >= 60000) {
        currentWave++;
        zombieSpeedMultiplier *= 2.0;
        spawnInterval = Math.max(1000, spawnInterval * 0.8);
        lastWaveTime = now;

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

// ==================== 创建场景对象 ====================
baseObject = GameModels.createBase();
world.scene.add(baseObject);

const road1Data = GameModels.createRoad(0, SPAWN_DISTANCE * 2, 0, 0, 3.2, 0x333333);
world.scene.add(road1Data.road);
world.scene.add(road1Data.stripe);

const road2Data = GameModels.createRoad(0, -SPAWN_DISTANCE * 2, 0, 0, 3.2, 0x333333);
world.scene.add(road2Data.road);
world.scene.add(road2Data.stripe);

turret = GameModels.createTurret();
world.scene.add(turret);

const heartsData = GameModels.createHearts();
world.scene.add(heartsData.heartGroup);
hearts = heartsData.hearts;

const helipad1 = new Helipad(-12, 0, -22);
const helipad2 = new Helipad(12, 0, -22);
const helipad3 = new Helipad(-12, 0, 22);
const helipad4 = new Helipad(12, 0, 22);

helipads = [helipad1, helipad2, helipad3, helipad4];

world.add(helipad1);
world.add(helipad2);
world.add(helipad3);
world.add(helipad4);

console.log("✓ Helipads created: 4, Helicopters: 0");

// ==================== 创建装甲战车 ====================
armoredVehicle = new ArmoredVehicle({
    x: 0,
    z: 10,
    rotation: 0,
    scale: 0.5
});

world.scene.add(armoredVehicle.group);
console.log("✓ Armored Vehicle created at (0, 0, 10)");

// ==================== 初始化战斗管理器 ====================
combatManager = new CombatManager(world, {
    TURRET_DAMAGE: TURRET_DAMAGE,
    HELI_DAMAGE: HELI_DAMAGE,
    VEHICLE_DAMAGE: 80,
    ZOMBIE_GOLD_REWARD: ZOMBIE_GOLD_REWARD,
    BASE_RADIUS: BASE_RADIUS
});

combatManager.setVehicle(armoredVehicle);
combatManager.setPlayerGold(playerGold);

console.log("✓ Combat Manager initialized");

// ==================== 战车移动控制 ====================
function updateVehicleControl() {
    if (!armoredVehicle) return;

    const forward = keys['w'] ? 1 : keys['s'] ? -1 : 0;
    const turn = keys['a'] ? 1 : keys['d'] ? -1 : 0;

    if (keys[' ']) {
        armoredVehicle.maxSpeed = 0.6;
    } else {
        armoredVehicle.maxSpeed = 0.3;
    }

    armoredVehicle.move(forward, turn);
}

// ==================== 相机跟随战车（从车后上方、俯视前方） ====================
function updateVehicleCamera() {
    if (!armoredVehicle) return;

    const vehicleObj = armoredVehicle.group;   // 真正持有位姿的对象

    // ===== 可以调的参数 =====
    // 距离车的后方距离（越大越远）
    const CAMERA_DISTANCE = 35;   

    // 相机高度（越大越高）
    const CAMERA_HEIGHT = 25;     

    // 看向车前方多远的位置（越大越“看远处”）
    const LOOK_FORWARD = 14;     

    // 相机视线目标的高度（越小越往下看）
    const LOOK_HEIGHT = -5;       
    // ======================

    // 1. 相机位置：车的局部(0, CAMERA_HEIGHT, -CAMERA_DISTANCE) → 世界坐标（车后上方）
    const cameraOffsetLocal = new T.Vector3(0, CAMERA_HEIGHT, -CAMERA_DISTANCE);
    const cameraWorldPos = cameraOffsetLocal.clone();
    vehicleObj.localToWorld(cameraWorldPos);

    // 平滑跟随
    world.camera.position.lerp(cameraWorldPos, 0.15);

    // 2. 视线目标：车的局部(0, LOOK_HEIGHT, LOOK_FORWARD) → 世界坐标（车头前方偏下）
    const lookAtLocal = new T.Vector3(0, LOOK_HEIGHT, LOOK_FORWARD);
    const lookAtWorld = lookAtLocal.clone();
    vehicleObj.localToWorld(lookAtWorld);

    world.camera.lookAt(lookAtWorld);

    // 3. 如果有 OrbitControls，顺便更新 target，避免它把视线改回原点
    if (world.controls && world.controls.target) {
        world.controls.target.copy(lookAtWorld);
        if (typeof world.controls.update === "function") {
            world.controls.update();
        }
    }
    if (world.orbit_controls && world.orbit_controls.target) {
        world.orbit_controls.target.copy(lookAtWorld);
        if (typeof world.orbit_controls.update === "function") {
            world.orbit_controls.update();
        }
    }
}


// ==================== 僵尸生成 ====================
function spawnZombie() {
    if (gameOver) return;
    const zombieVideo = document.getElementById('zombie-video');
    if (!zombieVideo) return;

    const spawnAtTop = Math.random() < 0.5;
    const jitterX = (Math.random() - 0.5) * 1.6;
    const radius = SPAWN_DISTANCE + Math.random() * 3;
    const sx = jitterX;
    const sz = spawnAtTop ? -radius : radius;

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
}

// ==================== 骨骼绘制 ====================
function drawSkeleton(pose) {
    skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);

    if (!pose || !pose.keypoints) return;

    const keypoints = pose.keypoints;
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

// ==================== 初始化僵尸系统 ====================
async function initZombies() {
    statusDiv.textContent = "Initializing...";

    try {
        sharedDetector = await initSharedDetector();

        if (!sharedDetector) {
            console.error("Failed to initialize shared detector");
            statusDiv.textContent = "Failed";
            return;
        }

        console.log("✓ Shared detector initialized");
        poseDetectionLoop();

        zombiesInitialized = true;
        statusDiv.textContent = "Ready";

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

// ==================== 主更新循环 ====================
function updateLoop() {
    debugFrameCount++;

    if (zombiesInitialized && !gameOver) {
        // 战车控制和相机
        updateVehicleControl();
        updateVehicleCamera();

        // 战斗系统（由CombatManager统一管理）
        baseHealth = combatManager.update(
            turret,
            helicopters,
            zombies,
            baseHealth,
            hearts,
            (newHealth) => {
                baseHealth = newHealth;
                updateUI();
            },
            () => {
                showGameOver();
            }
        );

        // 波次系统
        updateWaveSystem();

        // 更新UI
        updateUI();
    }

    // Debug状态报告（每5秒）
    const now = Date.now();
    if (now - lastDebugTime > 5000) {
        console.log("\n=== STATUS REPORT ===");
        console.log(`Zombies alive: ${zombies.length}`);
        console.log(`Base health: ${baseHealth}/5`);
        console.log(`Game over: ${gameOver}`);
        console.log(`Total kills: ${totalKills}`);
        console.log(`Gold: ${playerGold}`);
        console.log("====================\n");
        lastDebugTime = now;
    }

    requestAnimationFrame(updateLoop);
}

// ==================== 相机设置 ====================
world.camera.position.set(0, 8, -2);
// world.camera.lookAt(0, 2, 10);  // 让 updateVehicleCamera 控制相机方向
world.solo_camera.position.set(1, 1, 1);

// 如完全不需要鼠标控制相机，也可以直接禁用 OrbitControls：
// if (world.controls) world.controls.enabled = false;
// if (world.orbit_controls) world.orbit_controls.enabled = false;

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
