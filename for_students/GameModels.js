import * as T from "three";

/**
 * GameModels.js
 * 包含所有游戏中的3D建模函数
 */

// ==================== 基地建模 ====================
export function createBase() {
    const baseGroup = new T.Group();
    
    // 主基地平台
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
    
    // 护盾环
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
    
    // 天线
    const antennaGeo = new T.CylinderGeometry(0.1, 0.15, 2, 8);
    const antennaMaterial = new T.MeshStandardMaterial({
        color: 0x666666,
        metalness: 0.8,
        roughness: 0.3
    });
    const antenna = new T.Mesh(antennaGeo, antennaMaterial);
    antenna.position.y = 2.5;
    baseGroup.add(antenna);
    
    // 信号灯
    const signalLightGeo = new T.SphereGeometry(0.2, 16, 16);
    const signalMaterial = new T.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1.5
    });
    const signalLight = new T.Mesh(signalLightGeo, signalMaterial);
    signalLight.position.y = 3.5;
    baseGroup.add(signalLight);
    
    // 窗户（6个）
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
    
    // 控制面板（6个）
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
    
    console.log("✓ Base created at (0, 0, 0)");
    return baseGroup;
}

// ==================== 道路建模 ====================
export function createRoad(fromX, fromZ, toX = 0, toZ = 0, width = 2.0, color = 0x222222) {
    const start = new T.Vector3(fromX, 0, fromZ);
    const end = new T.Vector3(toX, 0, toZ);
    const dir = new T.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 0.001) return;

    // 道路主体
    const geo = new T.BoxGeometry(width, 0.02, length);
    const mat = new T.MeshStandardMaterial({
        color: color,
        roughness: 0.9,
        metalness: 0.1
    });
    const road = new T.Mesh(geo, mat);

    const mid = new T.Vector3().addVectors(start, end).multiplyScalar(0.5);
    road.position.copy(mid);

    const q = new T.Quaternion();
    q.setFromUnitVectors(new T.Vector3(0, 0, 1), dir.normalize());
    road.quaternion.copy(q);

    // 中央黄线
    const stripGeo = new T.BoxGeometry(0.1, 0.01, length);
    const stripMat = new T.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.3
    });
    const stripe = new T.Mesh(stripGeo, stripMat);
    stripe.position.copy(mid);
    stripe.position.y = 0.021;
    stripe.quaternion.copy(q);
    
    return { road, stripe };
}

// ==================== 炮塔建模 ====================
export function createTurret() {
    const turretGroup = new T.Group();
    
    // 底座
    const baseGeo = new T.CylinderGeometry(0.5, 0.6, 0.3, 8);
    const baseMaterial = new T.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.2
    });
    const base = new T.Mesh(baseGeo, baseMaterial);
    base.position.y = 1.65;
    turretGroup.add(base);
    
    // 旋转部分
    turretGroup.rotator = new T.Group();
    turretGroup.rotator.position.y = 1.8;
    turretGroup.add(turretGroup.rotator);
    
    // 炮管
    const barrelGeo = new T.CylinderGeometry(0, 0, 0, 0);//disabled
    const barrelMaterial = new T.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.95,
        roughness: 0.1
    });
    const barrel = new T.Mesh(barrelGeo, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.6, 0, 0);
    turretGroup.rotator.add(barrel);
    
    // 炮口
    const muzzleGeo = new T.CylinderGeometry(0, 0, 0, 0);//disabled
    const muzzle = new T.Mesh(muzzleGeo, barrelMaterial);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(1.2, 0, 0);
    turretGroup.rotator.add(muzzle);
    
    // 炮塔主体
    const turretBodyGeo = new T.BoxGeometry(0.6, 0.4, 0.6);
    const turretBody = new T.Mesh(turretBodyGeo, baseMaterial);
    turretGroup.rotator.add(turretBody);
    
    // 激光瞄准器
    const laserGeo = new T.CylinderGeometry(0, 0, 0, 0);
    const laserMaterial = new T.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.5
    });
    turretGroup.laser = new T.Mesh(laserGeo, laserMaterial);
    turretGroup.laser.rotation.x = Math.PI / 2;
    turretGroup.laser.position.set(6.2, 0, 0);
    turretGroup.laser.visible = false;
    turretGroup.rotator.add(turretGroup.laser);
    
    turretGroup.targetZombie = null;
    
    return turretGroup;
}

// ==================== 生命心形建模 ====================
export function createHearts() {
    const heartGroup = new T.Group();
    const hearts = [];
    
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
    
    console.log("✓ Hearts created:", hearts.length);
    return { heartGroup, hearts };
}

// ==================== 子弹建模 ====================
export function createBullet(startPos, endPos, color = 0xffff00) {
    const direction = new T.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    direction.normalize();

    const bulletGeo = new T.CylinderGeometry(0.05, 0.05, distance, 8);
    const bulletMat = new T.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 2.0
    });

    const bullet = new T.Mesh(bulletGeo, bulletMat);
    
    const midpoint = new T.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    bullet.position.copy(midpoint);

    const quaternion = new T.Quaternion();
    quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
    bullet.quaternion.copy(quaternion);

    const light = new T.PointLight(color, 1, 3);
    bullet.add(light);

    return bullet;
}

// ==================== 枪口火光建模 ====================
export function createMuzzleFlash(position) {
    const flashGeo = new T.SphereGeometry(0.3, 8, 8);
    const flashMat = new T.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xffaa00,
        emissiveIntensity: 3.0,
        transparent: true,
        opacity: 0.8
    });
    const flash = new T.Mesh(flashGeo, flashMat);
    flash.position.copy(position);

    const light = new T.PointLight(0xffaa00, 2, 5);
    flash.add(light);

    return flash;
}

// ==================== 战车子弹建模 ====================
export function createVehicleBullet(position, direction) {
    const bulletGeo = new T.SphereGeometry(0.15, 8, 8);
    const bulletMat = new T.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffaa00,
        emissiveIntensity: 2
    });
    const bullet = new T.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(position);
    
    const light = new T.PointLight(0xffaa00, 2, 5);
    bullet.add(light);
    
    return {
        mesh: bullet,
        velocity: direction.clone().multiplyScalar(0.8),
        life: 100
    };
}

// ==================== 战车枪口火光 ====================
export function createVehicleMuzzleFlash(position) {
    const flashGeo = new T.SphereGeometry(0.3, 8, 8);
    const flashMat = new T.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xffaa00,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0.8
    });
    const flash = new T.Mesh(flashGeo, flashMat);
    flash.position.copy(position);
    
    return flash;
}

// ==================== 导出所有建模函数 ====================
export const GameModels = {
    createBase,
    createRoad,
    createTurret,
    createHearts,
    createBullet,
    createMuzzleFlash,
    createVehicleBullet,
    createVehicleMuzzleFlash
};