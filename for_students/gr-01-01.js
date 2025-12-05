/*jshint esversion: 6 */
// @ts-check

import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import * as T from "../libs/CS559-Three/build/three.module.js";
// ⚠️ 新增：导入 OBJLoader (依赖 HTML 中的 importmap)
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

import { DetailedHelicopter, Helipad } from "./DetailedHelicopter.js";
import { Zombie, initSharedDetector, getPoseModelType } from "./Zombie.js";
import { GameModels } from "./GameModels.js";
import { ArmoredVehicle } from "./Armoredvehicle.js"; 
import { CombatManager } from "./Combatmanager.js"; 

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

let gameStarted = false;
let baseHealth = 5;
let gameOver = false;
let baseObject;
let hearts = [];
let turret;
let armoredVehicle = null;
let combatManager = null;

let playerGold = 500;
let totalKills = 0;
let currentWave = 1;
let spawnInterval = 5000;
let zombieSpeedMultiplier = 1.0;

const BASE_RADIUS = 2.8;
const TURRET_DAMAGE = 50;
const HELI_DAMAGE = 30;
const ZOMBIE_BASE_HEALTH = 1000;
const ZOMBIE_GOLD_REWARD = 30;
const HELI_PRICE = 500;
const SPAWN_DISTANCE = 22;

let debugFrameCount = 0;
let lastDebugTime = Date.now();
let lastWaveTime = Date.now();
let zombieSpawnTimer = null;
let zombiesInitialized = false;
let keys = {};

// ==================== Full Mode 资源变量 ====================
let isFullMode = false;
const textureLoader = new T.TextureLoader();
const objLoader = new OBJLoader();

// 1. 加载地面纹理
const groundTexture = textureLoader.load('./assets/grass.jpg', function(tex) {
    tex.wrapS = T.RepeatWrapping;
    tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(20, 20); // 让草地重复，避免拉伸
});

// 2. 加载天空纹理
const skyTexture = textureLoader.load('./assets/sky.jpg');

// 3. 加载 OBJ 树木组
const decorationGroup = new T.Group();
decorationGroup.visible = false; // 默认隐藏 (Prototype Mode)

// 保存原始材质，方便切换回 Prototype
let defaultGroundMat = null;
let defaultBackground = null;

// ==================== 初始化世界 ====================
world = new GrWorld({
    groundplanecolor: "#2a4d2a",
    groundplanesize: 50,
    width: window.innerWidth,
    height: window.innerHeight * 2,
    where: document.getElementById("div1")
});

// ⚠️ 将装饰物添加到场景
world.scene.add(decorationGroup);

// ⚠️ 加载 Tree.obj
objLoader.load('./assets/tree.obj', (root) => {
    // 遍历模型，给它上个简单的绿色，因为 obj 通常没有材质
    root.traverse(function(child) {
        if (child.isMesh) {
            child.material = new T.MeshStandardMaterial({ color: 0x228b22 });
            child.castShadow = true;
        }
    });

    // 创建 10 棵树作为装饰
    for (let i = 0; i < 10; i++) {
        const tree = root.clone();
        // 随机分布在道路两侧
        const side = Math.random() > 0.5 ? 1 : -1;
        const x = side * (15 + Math.random() * 10);
        const z = (Math.random() - 0.5) * 40;
        
        tree.position.set(x, 0, z);
        
        // 随机缩放和旋转
        const scale = 0.1 + Math.random() * 0.1; // 根据你的 obj 大小调整这里的 0.5
        tree.scale.set(scale, scale, scale);
        tree.rotation.y = Math.random() * Math.PI * 2;
        
        decorationGroup.add(tree);
    }
    console.log("🌲 Trees loaded via OBJLoader");
}, undefined, (error) => {
    console.warn("Could not load tree.obj. Make sure it is in assets/ folder.", error);
});

// ==================== 模式切换逻辑 ====================
function toggleGameMode() {
    isFullMode = !isFullMode;
    const btn = document.getElementById('mode-toggle');
    if (btn) {
        btn.textContent = isFullMode ? "Switch to PROTOTYPE" : "Switch to FULL MODE";
        
        // ⚠️ 关键修复：点击后让按钮失去焦点
        // 这样按空格键就不会再次触发这个按钮了
        btn.blur(); 
    }

    // 1. 切换背景 (天空)
    if (isFullMode) {
        if (!defaultBackground) defaultBackground = world.scene.background;
        world.scene.background = skyTexture;
    } else {
        world.scene.background = defaultBackground || new T.Color("#000");
    }

    // 2. 切换地面纹理
    if (world.groundplane && world.groundplane.mesh) {
        const mesh = world.groundplane.mesh;
        if (!defaultGroundMat) defaultGroundMat = mesh.material;

        if (isFullMode) {
            mesh.material = new T.MeshStandardMaterial({
                map: groundTexture,
                roughness: 0.8
                // metalness: 0.1
            });
        } else {
            mesh.material = defaultGroundMat;
        }
    }
    
    // 3. 显示/隐藏 加载的模型 (Trees)
    decorationGroup.visible = isFullMode;

    console.log(`Mode switched to: ${isFullMode ? "FULL" : "PROTOTYPE"}`);
}

const modeBtn = document.getElementById('mode-toggle');
if (modeBtn) modeBtn.addEventListener('click', toggleGameMode);


// ==================== 窗口与尺寸同步 ====================
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
    if (skeletonCanvas && document.getElementById('zombie-video')) {
         const vid = document.getElementById('zombie-video');
         if(vid.videoWidth) {
             skeletonCanvas.width = vid.videoWidth;
             skeletonCanvas.height = vid.videoHeight;
         }
    }
}
window.addEventListener('resize', onWindowResize);
onWindowResize();

// ==================== 键盘控制 ====================
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ==================== UI 元素 ====================
statusDiv = document.getElementById("status");
zombieCountDiv = document.getElementById("zombie-count");
heliCountDiv = document.getElementById("heli-count");
killCountDiv = document.getElementById("kill-count");
goldDisplayDiv = document.getElementById("gold-display");
healthDisplayDiv = document.getElementById("health-display");
waveNumberDiv = document.getElementById("wave-number");
waveLabelDiv = document.getElementById("wave-label");
skeletonCanvas = document.getElementById('skeleton-canvas');
if (skeletonCanvas) skeletonCtx = skeletonCanvas.getContext('2d');

// ==================== UI 更新 ====================
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
        if (playerGold < HELI_PRICE) buyButton.classList.add('disabled');
        else buyButton.classList.remove('disabled');
    }
}

function showPurchaseNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'message';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

function showGameOver() {
    gameOver = true;
    console.log("💀 GAME OVER! 💀");
    document.getElementById('final-wave').textContent = currentWave;
    document.getElementById('final-kills').textContent = totalKills;
    document.getElementById('final-gold').textContent = playerGold;
    document.getElementById('game-over-screen').classList.add('show');
    if (zombieSpawnTimer) clearInterval(zombieSpawnTimer);
}

const restartBtn = document.getElementById('restart-button');
if(restartBtn) restartBtn.addEventListener('click', () => location.reload());

// ==================== 购买直升机 ====================
function buyHelicopter() {
    if (playerGold < HELI_PRICE) return showPurchaseNotification('❌ Not enough gold!');
    if (helipads.length === 0) return showPurchaseNotification('❌ No helipads available!');

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

    if (!availablePad) return showPurchaseNotification('❌ All helipads occupied!');

    playerGold -= HELI_PRICE;
    if (combatManager) combatManager.setPlayerGold(playerGold);

    const colors = [0x2194ce, 0x21ce94, 0xce2194, 0xce9421, 0x9421ce];
    const color = colors[helicopters.length % colors.length];
    const heli = new DetailedHelicopter({ x: availablePad.x, y: 0, z: availablePad.z, scale: 1, color: color, altitude: 5 + helicopters.length * 0.5 });

    world.add(heli);
    helicopters.push(heli);
    heli.getPads(helipads);
    updateUI();
    showPurchaseNotification('✅ Helicopter deployed!');
}
const buyBtn = document.getElementById('buy-helicopter');
if(buyBtn) buyBtn.addEventListener('click', buyHelicopter);

// ==================== 波次系统 ====================
function updateWaveSystem() {
    if (!gameStarted) return;
    const now = Date.now();
    const elapsed = now - lastWaveTime;
    if (elapsed >= 60000) {
        currentWave++;
        zombieSpeedMultiplier *= 2.0;
        spawnInterval = Math.max(1000, spawnInterval * 0.8);
        lastWaveTime = now;
        if (zombieSpawnTimer) clearInterval(zombieSpawnTimer);
        zombieSpawnTimer = setInterval(() => { if (!gameOver && gameStarted) spawnZombie(); }, spawnInterval);
        showPurchaseNotification(`🌊 WAVE ${currentWave} - Difficulty Increased!`);
    }
}

// ==================== 场景构建 ====================
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
helipads = [new Helipad(-12, 0, -22), new Helipad(12, 0, -22), new Helipad(-12, 0, 22), new Helipad(12, 0, 22)];
helipads.forEach(pad => world.add(pad));

armoredVehicle = new ArmoredVehicle({ x: 0, z: 10, rotation: 0, scale: 0.5 });
world.scene.add(armoredVehicle.group);

if (typeof CombatManager === 'undefined') console.error("❌ CRITICAL ERROR: CombatManager undefined.");
combatManager = new CombatManager(world, { TURRET_DAMAGE, HELI_DAMAGE, VEHICLE_DAMAGE: 80, ZOMBIE_GOLD_REWARD, BASE_RADIUS });
combatManager.setVehicle(armoredVehicle);
combatManager.setPlayerGold(playerGold);

// ==================== 战车控制 ====================
function updateVehicleControl() {
    if (!armoredVehicle || !gameStarted) return;
    const forward = keys['w'] ? 1 : keys['s'] ? -1 : 0;
    const turn = keys['a'] ? 1 : keys['d'] ? -1 : 0;
    armoredVehicle.maxSpeed = keys[' '] ? 0.6 : 0.3;
    armoredVehicle.move(forward, turn);
}

function updateVehicleCamera() {
    if (!armoredVehicle) return;
    const vehicleObj = armoredVehicle.group;
    const cameraOffsetLocal = new T.Vector3(0, 25, -35);
    const cameraWorldPos = cameraOffsetLocal.clone();
    vehicleObj.localToWorld(cameraWorldPos);
    world.camera.position.lerp(cameraWorldPos, 0.15);
    const lookAtLocal = new T.Vector3(0, -5, 14);
    const lookAtWorld = lookAtLocal.clone();
    vehicleObj.localToWorld(lookAtWorld);
    world.camera.lookAt(lookAtWorld);
    if (world.controls && world.controls.target) world.controls.target.copy(lookAtWorld);
    if (world.orbit_controls && world.orbit_controls.target) world.orbit_controls.target.copy(lookAtWorld);
}

// ==================== 僵尸生成 ====================
function spawnZombie() {
    if (gameOver || !gameStarted) return;
    const zombieVideo = document.getElementById('zombie-video');
    if (!zombieVideo) return;
    const spawnAtTop = Math.random() < 0.5;
    const radius = SPAWN_DISTANCE + Math.random() * 3;
    const zombie = new Zombie({
        x: (Math.random() - 0.5) * 1.6,
        z: spawnAtTop ? -radius : radius,
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
    if (!skeletonCtx || !skeletonCanvas) return;
    skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
    if (!pose || !pose.keypoints) return;
    const keypoints = pose.keypoints;
    const findKeypointByName = (name) => {
        for (let i = 0; i < keypoints.length; i++) {
            if (keypoints[i].name === name || keypoints[i].part === name || keypoints[i].label === name) return keypoints[i];
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
    const videoEl = document.getElementById('zombie-video');
    if (!videoEl) return;
    const scaleX = skeletonCanvas.width / (videoEl.videoWidth || 640);
    const scaleY = skeletonCanvas.height / (videoEl.videoHeight || 480);
    
    skeletonCtx.strokeStyle = '#44ff44';
    skeletonCtx.lineWidth = 3;
    skeletonCtx.lineCap = 'round';
    
    const DRAW_CONNECTIONS = [['left_shoulder', 11, 5, 'right_shoulder', 12, 6], ['left_shoulder', 11, 5, 'left_hip', 23, 11], ['right_shoulder', 12, 6, 'right_hip', 24, 12], ['left_shoulder', 11, 5, 'left_elbow', 13, 7], ['left_elbow', 13, 7, 'left_wrist', 15, 9], ['right_shoulder', 12, 6, 'right_elbow', 14, 8], ['right_elbow', 14, 8, 'right_wrist', 16, 10], ['left_hip', 23, 11, 'left_knee', 25, 13], ['left_knee', 25, 13, 'left_ankle', 27, 15], ['right_hip', 24, 12, 'right_knee', 26, 14], ['right_knee', 26, 14, 'right_ankle', 28, 16]];
    for (const c of DRAW_CONNECTIONS) {
        const A = get2DPosBy(c[0], c[1], c[2]);
        const B = get2DPosBy(c[3], c[4], c[5]);
        if (A && B) {
            skeletonCtx.beginPath();
            skeletonCtx.moveTo(A.x * scaleX, A.y * scaleY);
            skeletonCtx.lineTo(B.x * scaleX, B.y * scaleY);
            skeletonCtx.stroke();
        }
    }
}

// ==================== 姿态检测 ====================
async function poseDetectionLoop() {
    const video = document.getElementById('zombie-video');
    if (!sharedDetector || !video || !video.videoWidth) {
        requestAnimationFrame(poseDetectionLoop);
        return;
    }
    try {
        const poses = await sharedDetector.estimatePoses(video, { flipHorizontal: false });
        if (poses && poses.length > 0) {
            drawSkeleton(poses[0]);
            zombies.forEach(zombie => zombie.applyPoseToModel(poses[0]));
        }
    } catch (error) { console.error(error); }
    requestAnimationFrame(poseDetectionLoop);
}

async function initZombies() {
    statusDiv.textContent = "Initializing...";
    try {
        sharedDetector = await initSharedDetector();
        if (!sharedDetector) return;
        poseDetectionLoop();
        zombiesInitialized = true;
        statusDiv.textContent = "Waiting for Start..."; 
        updateUI();
    } catch (error) { console.error(error); }
}
initZombies();

// ==================== 开始游戏与控制 ====================
const startBtn = document.getElementById('start-game-btn');
const startScreen = document.getElementById('start-screen');
if (startBtn && startScreen) {
    startBtn.addEventListener('click', () => {
        startScreen.style.display = 'none';
        gameStarted = true;
        statusDiv.textContent = "Game Started!";
        lastWaveTime = Date.now();
        if (!zombieSpawnTimer) zombieSpawnTimer = setInterval(() => { if (!gameOver) spawnZombie(); }, spawnInterval);
        const video = document.getElementById('zombie-video');
        if (video) video.play().catch(e => console.log(e));
    });
}

function setupMobileControls() {
    const map = { 'btn-w': 'w', 'btn-a': 'a', 'btn-s': 's', 'btn-d': 'd', 'btn-space': ' ' };
    const setKey = (key, state) => { if (keys[key] !== state) keys[key] = state; };
    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); setKey(map[id], true); el.classList.add('active'); }, { passive: false });
        el.addEventListener('touchend', (e) => { e.preventDefault(); setKey(map[id], false); el.classList.remove('active'); }, { passive: false });
        el.addEventListener('mousedown', (e) => { setKey(map[id], true); el.classList.add('active'); });
        const clear = () => { setKey(map[id], false); el.classList.remove('active'); };
        el.addEventListener('mouseup', clear);
        el.addEventListener('mouseleave', clear);
    });
}
setupMobileControls();

// ==================== 主循环 ====================
function updateLoop() {
    debugFrameCount++;
    if (gameStarted && zombiesInitialized && !gameOver) {
        updateVehicleControl();
        updateVehicleCamera();
        if (combatManager) {
            baseHealth = combatManager.update(turret, helicopters, zombies, baseHealth, hearts, (h) => { baseHealth = h; updateUI(); }, showGameOver);
        }
        updateWaveSystem();
        updateUI();
    } else if (!gameStarted && zombiesInitialized) {
        updateVehicleCamera();
    }
    requestAnimationFrame(updateLoop);
}

if(world && world.camera) world.camera.position.set(0, 8, -2);
if(world && world.solo_camera) world.solo_camera.position.set(1, 1, 1);

world.go();
updateLoop();
updateUI();