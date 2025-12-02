/*jshint esversion: 6 */
// @ts-check

import * as T from "../libs/CS559-Three/build/three.module.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";

/**
 * 停机坪类
 */
let helipadCount = 0;
let helipadGeometry;
let helipadMaterial;

export class Helipad extends GrObject {
    constructor(x = 0, y = 0, z = 0) {
        if (!helipadGeometry) {
            const q = 0.25;
            const h = 0.5;
            const verts = new Float32Array([
                -1,0,-1,  -1,0, 1,  -h,0, 1,  -h,0,-1,
                 1,0,-1,   1,0, 1,   h,0, 1,   h,0,-1,
                -h,0,-q,  -h,0, q,   h,0, q,   h,0,-q
            ]);
            const padidx = [2, 1, 0, 3, 2, 0, 4, 5, 6, 4, 6, 7, 10, 9, 8, 10, 8, 11];
            
            helipadGeometry = new T.BufferGeometry();
            helipadGeometry.setAttribute("position", new T.BufferAttribute(verts, 3));
            helipadGeometry.setIndex(padidx);
            helipadGeometry.computeVertexNormals();
            
            if (!helipadMaterial) {
                helipadMaterial = new T.MeshStandardMaterial({
                    color: "#FFFF00",
                    side: T.DoubleSide,
                    roughness: 0.7
                });
            }
        }
        
        let mesh = new T.Mesh(helipadGeometry, helipadMaterial);
        super(`Helipad-${++helipadCount}`, mesh);
        mesh.position.set(x, y + 0.01, z);
        this.mesh = mesh;
    }
}

function shortestAngleDiff(target, current) {
    let diff = target - current;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
}

/**
 * 高精度直升机类 - 带自动飞行功能
 */
export class DetailedHelicopter extends GrObject {
    constructor(params = {}) {
        let helicopter = new T.Group();
        super(`DetailedHelicopter-${DetailedHelicopter.counter++}`, helicopter);
        
        this.helicopter = helicopter;
        let x = params.x || 0;
        let y = params.y || 0;
        let z = params.z || 0;
        let scale = params.scale || 1;
        let bodyColor = params.color || 0x2194ce;
        this.altitude = params.altitude || 5;
        
        const bodyMaterial = new T.MeshStandardMaterial({ 
            color: bodyColor, 
            metalness: 0.6, 
            roughness: 0.3
        });
        const windowMaterial = new T.MeshStandardMaterial({ 
            color: 0x87CEEB, 
            metalness: 0.9, 
            roughness: 0.1, 
            transparent: true, 
            opacity: 0.7
        });
        const rotorMaterial = new T.MeshStandardMaterial({ 
            color: 0x333333, 
            metalness: 0.7, 
            roughness: 0.2
        });
        const skidMaterial = new T.MeshStandardMaterial({ 
            color: 0x444444, 
            metalness: 0.5, 
            roughness: 0.5
        });
        
        // 驾驶舱 - 半球形
        const cockpitGeometry = new T.SphereGeometry(0.6, 16, 16, 0, Math.PI);
        const cockpit = new T.Mesh(cockpitGeometry, bodyMaterial);
        cockpit.rotation.y = Math.PI / 2;
        cockpit.position.set(0.3, 0.2, 0);
        cockpit.scale.set(1.2, 0.9, 1);
        helicopter.add(cockpit);
        
        // 主机身
        const mainBodyGeometry = new T.CylinderGeometry(0.5, 0.5, 2, 16);
        const mainBody = new T.Mesh(mainBodyGeometry, bodyMaterial);
        mainBody.rotation.z = Math.PI / 2;
        mainBody.position.set(-0.5, 0.2, 0);
        helicopter.add(mainBody);
        
        // 尾锥
        const tailConeGeometry = new T.ConeGeometry(0.5, 1, 16);
        const tailCone = new T.Mesh(tailConeGeometry, bodyMaterial);
        tailCone.rotation.z = -Math.PI / 2;
        tailCone.position.set(-1.8, 0.2, 0);
        helicopter.add(tailCone);
        
        // 前窗
        const frontWindowGeometry = new T.SphereGeometry(0.59, 12, 12, 0, Math.PI * 1);
        const frontWindow = new T.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.rotation.y = Math.PI / 2;
        frontWindow.position.set(0.35, 0.3, 0);
        frontWindow.scale.set(1.2, 0.8, 1);
        helicopter.add(frontWindow);
        
        // 尾梁
        const tailBoomGeometry = new T.CylinderGeometry(0.15, 0.15, 2, 12);
        const tailBoom = new T.Mesh(tailBoomGeometry, bodyMaterial);
        tailBoom.rotation.z = Math.PI / 2;
        tailBoom.position.set(-2.8, 0.2, 0);
        helicopter.add(tailBoom);
        
        // 垂直尾翼
        const verticalStabilizerGeometry = new T.BoxGeometry(0.05, 0.8, 0.6);
        const verticalStabilizer = new T.Mesh(verticalStabilizerGeometry, bodyMaterial);
        verticalStabilizer.position.set(-3.8, 0.7, 0);
        verticalStabilizer.rotation.y = Math.PI / 2;
        helicopter.add(verticalStabilizer);
        
        // 主旋翼系统
        this.mainRotorGroup = new T.Group();
        this.mainRotorGroup.position.set(-0.2, 1.0, 0);
        helicopter.add(this.mainRotorGroup);
        
        const rotorShaftGeometry = new T.CylinderGeometry(0.08, 0.08, 0.8, 12);
        const rotorShaft = new T.Mesh(rotorShaftGeometry, rotorMaterial);
        rotorShaft.position.y = 0.10;
        this.mainRotorGroup.add(rotorShaft);
        
        const rotorHubGeometry = new T.SphereGeometry(0.15, 12, 12);
        const rotorHub = new T.Mesh(rotorHubGeometry, rotorMaterial);
        rotorHub.position.y = 0.5;
        this.mainRotorGroup.add(rotorHub);
        
        this.mainRotorBlades = new T.Group();
        this.mainRotorBlades.position.y = 0.5;
        this.mainRotorGroup.add(this.mainRotorBlades);
        
        const bladeGeometry = new T.BoxGeometry(5, 0.02, 0.15);
        for (let i = 0; i < 4; i++) {
            const blade = new T.Mesh(bladeGeometry, rotorMaterial);
            blade.rotation.y = (Math.PI / 2) * i;
            this.mainRotorBlades.add(blade);
        }
        
        // 尾旋翼
        this.tailRotorGroup = new T.Group();
        this.tailRotorGroup.position.set(-3.8, 0.7, 0.1);
        this.tailRotorGroup.rotation.z = Math.PI / 2;
        helicopter.add(this.tailRotorGroup);
        
        const tailBladeGeometry = new T.BoxGeometry(0.9, 0.02, 0.08);
        for (let i = 0; i < 3; i++) {
            const tailBlade = new T.Mesh(tailBladeGeometry, rotorMaterial);
            tailBlade.rotation.z = (Math.PI * 2 / 3) * i;
            this.tailRotorGroup.add(tailBlade);
        }
        
   // 起落架
        const leftSkidGroup = new T.Group();
        helicopter.add(leftSkidGroup);
        
        const leftSkidGeometry = new T.CylinderGeometry(0.08, 0.08, 2.5, 12);
        const leftSkid = new T.Mesh(leftSkidGeometry, skidMaterial);
        leftSkid.rotation.z = Math.PI / 2;
        leftSkid.position.set(-0.3, -0.7, 0.65);
        leftSkidGroup.add(leftSkid);
        
        const leftFrontStrutGeometry = new T.CylinderGeometry(0.05, 0.05, 0.8, 8);
        const leftFrontStrut = new T.Mesh(leftFrontStrutGeometry, skidMaterial);
        leftFrontStrut.rotation.x = 0.3;
        leftFrontStrut.position.set(0.3, -0.3, 0.65);
        leftSkidGroup.add(leftFrontStrut);
        
        const leftRearStrut = new T.Mesh(leftFrontStrutGeometry, skidMaterial);
        leftRearStrut.rotation.x = 0.3;
        leftRearStrut.position.set(-0.7, -0.3, 0.65);
        leftSkidGroup.add(leftRearStrut);
        
        const rightSkidGroup = leftSkidGroup.clone();
        rightSkidGroup.position.z = -1.4;
        rightSkidGroup.rotation.x = -rightSkidGroup.rotation.x;
        helicopter.add(rightSkidGroup);

        leftFrontStrut.rotation.x = -0.3;
        leftRearStrut.rotation.x = -0.3;
        
        // ==================== 武器系统 ====================
        
        // 武器专用材质
        const weaponMaterial = new T.MeshStandardMaterial({
            color: 0x2c2c2c,
            metalness: 0.8,
            roughness: 0.2
        });
        
        // 左侧火箭弹发射器组 - 方形长筒
        const leftRocketPodGroup = new T.Group();
        helicopter.add(leftRocketPodGroup);
        
        // 发射器主体 - 方形长筒外壳
        const podBodyGeometry = new T.BoxGeometry(1.2, 0.25, 0.25);
        const leftPodBody = new T.Mesh(podBodyGeometry, weaponMaterial);
        leftPodBody.position.set(-0.3, 0.1, 0.75);
        leftRocketPodGroup.add(leftPodBody);
        
        // 发射器前端盖板
        const frontCapGeometry = new T.BoxGeometry(0.05, 0.25, 0.25);
        const frontCap = new T.Mesh(frontCapGeometry, weaponMaterial);
        frontCap.position.set(0.3, 0.1, 0.75);
        leftRocketPodGroup.add(frontCap);
        
        // 发射器后端盖板
        const backCapGeometry = new T.BoxGeometry(0.05, 0.25, 0.25);
        const backCap = new T.Mesh(backCapGeometry, weaponMaterial);
        backCap.position.set(-0.9, 0.1, 0.75);
        leftRocketPodGroup.add(backCap);
        
        // 火箭弹材质
        const rocketBodyMaterial = new T.MeshStandardMaterial({
            color: 0x556b2f,
            metalness: 0.7,
            roughness: 0.3
        });
        const rocketTipMaterial = new T.MeshStandardMaterial({
            color: 0xdc143c,
            metalness: 0.6,
            roughness: 0.4
        });
        const rocketFinMaterial = new T.MeshStandardMaterial({
            color: 0x2f4f4f,
            metalness: 0.8,
            roughness: 0.2
        });
        
        // 创建12枚火箭弹（3行4列）
        const rocketRows = 3;
        const rocketCols = 4;
        const rocketSpacingX = 0.28;
        const rocketSpacingY = 0.07;
        const rocketStartX = -0.7;
        const rocketStartY = 0.03;
        
        for (let row = 0; row < rocketRows; row++) {
            for (let col = 0; col < rocketCols; col++) {
                const rocketGroup = new T.Group();
                
                // 火箭弹主体
                const rocketBodyGeometry = new T.CylinderGeometry(0.022, 0.022, 0.22, 8);
                const rocketBody = new T.Mesh(rocketBodyGeometry, rocketBodyMaterial);
                rocketBody.rotation.z = Math.PI / 2;
                rocketGroup.add(rocketBody);
                
                // 火箭弹头（尖锥形）
                const rocketTipGeometry = new T.ConeGeometry(0.022, 0.06, 8);
                const rocketTip = new T.Mesh(rocketTipGeometry, rocketTipMaterial);
                rocketTip.rotation.z = -Math.PI / 2;
                rocketTip.position.x = 0.14;
                rocketGroup.add(rocketTip);
                
                // 火箭弹尾部稳定翼（4片）
                const finGeometry = new T.BoxGeometry(0.04, 0.001, 0.03);
                for (let i = 0; i < 4; i++) {
                    const fin = new T.Mesh(finGeometry, rocketFinMaterial);
                    const angle = (i / 4) * Math.PI * 2;
                    fin.position.x = -0.09;
                    fin.position.y = Math.sin(angle) * 0.025;
                    fin.position.z = Math.cos(angle) * 0.025;
                    fin.rotation.z = angle;
                    rocketGroup.add(fin);
                }
                
                // 火箭弹尾部环（装饰）
                const tailRingGeometry = new T.TorusGeometry(0.024, 0.004, 8, 12);
                const tailRing = new T.Mesh(tailRingGeometry, weaponMaterial);
                tailRing.rotation.y = Math.PI / 2;
                tailRing.position.x = -0.1;
                rocketGroup.add(tailRing);
                
                // 定位火箭弹
                rocketGroup.position.set(
                    rocketStartX + col * rocketSpacingX,
                    rocketStartY + row * rocketSpacingY,
                    0.75
                );
                
                leftRocketPodGroup.add(rocketGroup);
            }
        }
        
        // 发射器支架（上下两个）
        const topMountGeometry = new T.BoxGeometry(0.1, 0.04, 0.08);
        const topMount = new T.Mesh(topMountGeometry, weaponMaterial);
        topMount.position.set(-0.3, 0.24, 0.75);
        leftRocketPodGroup.add(topMount);
        
        const bottomMountGeometry = new T.BoxGeometry(0.1, 0.04, 0.08);
        const bottomMount = new T.Mesh(bottomMountGeometry, weaponMaterial);
        bottomMount.position.set(-0.3, -0.04, 0.75);
        leftRocketPodGroup.add(bottomMount);
        
        // 发射器连接杆
        const connectRodGeometry = new T.CylinderGeometry(0.025, 0.025, 0.15, 8);
        const connectRod = new T.Mesh(connectRodGeometry, weaponMaterial);
        connectRod.position.set(-0.3, 0.1, 0.67);
        leftRocketPodGroup.add(connectRod);
        
        // 加强筋（前后各一个）
        const frontRibGeometry = new T.BoxGeometry(0.03, 0.2, 0.01);
        const frontRib = new T.Mesh(frontRibGeometry, weaponMaterial);
        frontRib.position.set(0.2, 0.1, 0.75);
        leftRocketPodGroup.add(frontRib);
        
        const backRib = new T.Mesh(frontRibGeometry, weaponMaterial);
        backRib.position.set(-0.8, 0.1, 0.75);
        leftRocketPodGroup.add(backRib);
        
        // 右侧火箭弹发射器（镜像复制）
        const rightRocketPodGroup = leftRocketPodGroup.clone();
        rightRocketPodGroup.position.z = -1.5;
        helicopter.add(rightRocketPodGroup);
        
        // ==================== 前下方可旋转机枪 ====================
        
        // 机枪整体组（可旋转）
        this.machineGunGroup = new T.Group();
        helicopter.add(this.machineGunGroup);
        
        // 机枪转塔底座
        const gunTurretBaseGeometry = new T.CylinderGeometry(0.15, 0.18, 0.1, 12);
        const gunTurretBase = new T.Mesh(gunTurretBaseGeometry, weaponMaterial);
        gunTurretBase.position.set(0.5, -0.3, 0);
        this.machineGunGroup.add(gunTurretBase);
        
        // 可旋转部分
        this.gunRotator = new T.Group();
        this.gunRotator.position.set(0.5, -0.3, 0);
        this.machineGunGroup.add(this.gunRotator);
        
        // 机枪枪管材质
        const gunBarrelMaterial = new T.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.9,
            roughness: 0.1
        });
         // 机枪枪口
        const muzzleGeometry = new T.CylinderGeometry(0.05, 0.04, 0.05, 8);
        const muzzleMaterial = new T.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.3
        });
        // 枪管沿 +Z
const gunBarrelGeometry = new T.CylinderGeometry(0.04, 0.04, 0.6, 8);

// 左枪管
const leftGunBarrel = new T.Mesh(gunBarrelGeometry, gunBarrelMaterial);
leftGunBarrel.rotation.x = Math.PI / 2;        // Y -> Z
leftGunBarrel.position.set(0.05, 0.05, 0.3);   // 改成沿 z
this.gunRotator.add(leftGunBarrel);

// 右枪管
const rightGunBarrel = new T.Mesh(gunBarrelGeometry, gunBarrelMaterial);
rightGunBarrel.rotation.x = Math.PI / 2;
rightGunBarrel.position.set(0.05, 0.05, -0.3);
this.gunRotator.add(rightGunBarrel);

// 枪口
const leftMuzzle = new T.Mesh(muzzleGeometry, muzzleMaterial);
leftMuzzle.rotation.x = Math.PI / 2;
leftMuzzle.position.set(0.05, 0.05, 0.6);
this.gunRotator.add(leftMuzzle);

const rightMuzzle = new T.Mesh(muzzleGeometry, muzzleMaterial);
rightMuzzle.rotation.x = Math.PI / 2;
rightMuzzle.position.set(0.05, 0.05, -0.6);
this.gunRotator.add(rightMuzzle);

        
        // 弹链箱
        const ammoBoxGeometry = new T.BoxGeometry(0.15, 0.12, 0.25);
        const ammoBox = new T.Mesh(ammoBoxGeometry, weaponMaterial);
        ammoBox.position.set(0, -0.05, 0);
        this.gunRotator.add(ammoBox);
        
        // 机枪状态
        this.gunTarget = null;
        
       
        // 天线
        const antennaGeometry = new T.CylinderGeometry(0.02, 0.02, 0.4, 6);
        const antenna = new T.Mesh(antennaGeometry, rotorMaterial);
        antenna.position.set(-1.2, 0.9, 0);
        helicopter.add(antenna);
        
        // 着陆灯
        const landingLightGeometry = new T.SphereGeometry(0.08, 8, 8);
        const landingLightMaterial = new T.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5
        });
        const leftLight = new T.Mesh(landingLightGeometry, landingLightMaterial);
        leftLight.position.set(0.6, 0, 0.3);
        helicopter.add(leftLight);
        
        const rightLight = new T.Mesh(landingLightGeometry, landingLightMaterial);
        rightLight.position.set(0.6, 0, -0.3);
        helicopter.add(rightLight);
        
        helicopter.position.set(x, y, z);
        helicopter.scale.set(scale, scale, scale);
        this.rideable = helicopter;
        
        // 飞行状态机变量
        this.state = 0;
        this.delay = 0;
        this.goalangle = 0;
        this.currentangle = 0;
        this.pads = [];
        this.current = undefined;

        // ==================== 底部探照灯系统 ====================
        
        // 探照灯组
        this.spotlightGroup = new T.Group();
        helicopter.add(this.spotlightGroup);
        
        // 探照灯底座
        const spotlightBaseGeometry = new T.CylinderGeometry(0.15, 0.2, 0.15, 12);
        const spotlightBase = new T.Mesh(spotlightBaseGeometry, weaponMaterial);
        spotlightBase.position.set(0, -0.5, 0);
        this.spotlightGroup.add(spotlightBase);
        
        // 探照灯主体（可旋转部分）
        this.spotlightRotator = new T.Group();
        this.spotlightRotator.position.set(0, -0.5, 0);
        this.spotlightGroup.add(this.spotlightRotator);
        
        // 探照灯外壳
        const spotlightHousingGeometry = new T.CylinderGeometry(0.12, 0.08, 0.3, 16);
        const spotlightHousing = new T.Mesh(spotlightHousingGeometry, weaponMaterial);
        spotlightHousing.rotation.x = Math.PI / 2;
        spotlightHousing.position.z = 0.15;
        this.spotlightRotator.add(spotlightHousing);
        
        // 探照灯光源
        this.spotlight = new T.SpotLight(0xffffff, 2, 30, Math.PI / 6, 0.5, 1);
        this.spotlight.position.set(0, 0, 0.3);
        this.spotlight.target.position.set(0, -5, 5);
        this.spotlightRotator.add(this.spotlight);
        this.spotlightRotator.add(this.spotlight.target);
        
        // 探照灯发光环
        const lightRingGeometry = new T.TorusGeometry(0.09, 0.02, 8, 16);
        const lightRingMaterial = new T.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1.0
        });
        const lightRing = new T.Mesh(lightRingGeometry, lightRingMaterial);
        lightRing.rotation.z = Math.PI / 2;
        lightRing.position.z = 0.3;
        this.spotlightRotator.add(lightRing);
        
        // 探照灯状态
        this.spotlightTarget = null;
        this.spotlightRandomAngle = 0;
        this.spotlightRandomSpeed = 0.02;
    }
    
    /**
     * 获取所有停机坪
     */
    getPads(grObjectList) {
        let that = this;
        grObjectList.forEach(function (obj) {
            if (obj instanceof Helipad) {
                that.pads.push(obj);
            }
        });
        
        if (this.pads.length > 0) {
            this.current = this.pads[0];
            this.helicopter.position.x = this.current.mesh.position.x;
            this.helicopter.position.y = this.current.mesh.position.y;
            this.helicopter.position.z = this.current.mesh.position.z;
        }
    }
    
    /**
     * 每帧更新 - 旋翼旋转 + 自动飞行状态机
     */
 stepWorld(delta, timeOfDay) {
        let deltaSlowed = delta / 200;
        
        // 旋翼旋转
        this.mainRotorBlades.rotation.y += deltaSlowed * 4;
        this.tailRotorGroup.rotation.z += deltaSlowed * 6;
        
        // 自动飞行状态机
        if (this.pads.length > 0) {
            switch (this.state) {
                case 0: // 初始化
                    this.state = 1;
                    break;
                    
                case 1: // 上升
                    this.helicopter.position.y += deltaSlowed;
                    if (this.helicopter.position.y >= this.altitude) {
                        this.helicopter.position.y = this.altitude;
                        let targets = this.pads.filter((obj) => obj != this.current);
                        if (targets.length > 0) {
                            let pick = Math.floor(Math.random() * targets.length);
                            this.current = targets[pick];
                            let dx = this.current.mesh.position.x - this.helicopter.position.x;
                            let dz = this.current.mesh.position.z - this.helicopter.position.z;
                            let ds = Math.sqrt(dx * dx + dz * dz);
                            if (ds > 0) {
                                this.goalangle = Math.atan2(dx, dz);
                                let quat = new T.Quaternion();
                                this.helicopter.getWorldQuaternion(quat);
                                let eu = new T.Euler();
                                eu.setFromQuaternion(quat);
                                this.currentangle = eu.y;
                                this.state = 4;
                            }
                        }
                    }
                    break;
                    
                case 2: // 下降
                    this.helicopter.position.y -= deltaSlowed;
                    if (this.helicopter.position.y <= 1) {
                        this.helicopter.position.y = 1;
                        this.state = 3;
                        this.delay = 1 + Math.random();
                    }
                    break;
                    
                case 3: // 等待
                    this.delay -= deltaSlowed;
                    if (this.delay < 0) {
                        this.state = 1;
                    }
                    break;
                    
                case 4: // 转向
                    let ad = this.goalangle - this.currentangle;
                    if (ad > 0.1) {
                        this.currentangle += 0.05;
                    } else if (ad < -0.1) {
                        this.currentangle -= 0.05;
                    } else {
                        this.state = 5;
                        this.currentangle = this.goalangle;
                    }
                    this.helicopter.setRotationFromEuler(new T.Euler(0, this.currentangle, 0));
                    break;
                    
                case 5: // 巡航
                    let dx = this.current.mesh.position.x - this.helicopter.position.x;
                    let dz = this.current.mesh.position.z - this.helicopter.position.z;
                    let dst = Math.sqrt(dx * dx + dz * dz);
                    let ds = deltaSlowed * 1.5;
                    if (dst > ds) {
                        this.helicopter.position.x += (dx * ds) / dst;
                        this.helicopter.position.z += (dz * ds) / dst;
                    } else {
                        this.helicopter.position.x = this.current.mesh.position.x;
                        this.helicopter.position.z = this.current.mesh.position.z;
                        this.state = 2;
                    }
                    break;
            }
        }

        if (this.spotlightTarget) {
    // 锁定目标模式
    const targetPos = new T.Vector3();
    this.spotlightTarget.getWorldPosition(targetPos);
    const heliPos = new T.Vector3();
    this.helicopter.getWorldPosition(heliPos);
    
    // 计算方向
    const direction = new T.Vector3().subVectors(targetPos, heliPos);
    const horizontalDist = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    
    // 计算旋转角度（Y轴偏航）
    const targetAngleY = Math.atan2(direction.x, direction.z);
    // 计算俯仰角度（X轴）
    const targetAngleX = -Math.atan2(direction.y, horizontalDist);
    
    // ---- 使用“最短角度差”平滑旋转，避免无限转圈 ----
    const diffY = shortestAngleDiff(targetAngleY, this.spotlightRotator.rotation.y);
    this.spotlightRotator.rotation.y += diffY * 0.1;

    // 俯仰不用绕 2π，直接插值再做个限制
    const diffX = targetAngleX - this.spotlightRotator.rotation.x;
    this.spotlightRotator.rotation.x += diffX * 0.1;
    // 防止探照灯抬得太高/太低
    this.spotlightRotator.rotation.x = T.MathUtils.clamp(
        this.spotlightRotator.rotation.x,
        -Math.PI / 2,
        Math.PI / 6
    );

    // 这里用局部 +Z 作为光束方向即可，不要用世界方向向量
    this.spotlight.target.position.set(0, 0, 10);

} else {
    // 随机旋转模式（保持原来的“扫地”效果）
    this.spotlightRandomAngle += this.spotlightRandomSpeed;
    this.spotlightRotator.rotation.y = Math.sin(this.spotlightRandomAngle) * Math.PI / 3;
    this.spotlightRotator.rotation.x = -Math.PI / 6 + Math.cos(this.spotlightRandomAngle * 0.5);
}

// 机枪瞄准逻辑
if (this.gunTarget) {
    const targetPos = new T.Vector3();
    this.gunTarget.getWorldPosition(targetPos);
    const gunPos = new T.Vector3();
    this.gunRotator.getWorldPosition(gunPos);
    
    // 计算方向
    const direction = new T.Vector3().subVectors(targetPos, gunPos);
    const horizontalDist = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    
    // 计算旋转角度
    const targetAngleY = Math.atan2(direction.x, direction.z);
    const targetAngleX = -Math.atan2(direction.y, horizontalDist);
    
    // ---- 同样用“最短角度差”来避免机枪无穷转圈 ----
    const diffY = shortestAngleDiff(targetAngleY, this.gunRotator.rotation.y);
    this.gunRotator.rotation.y += diffY * 0.15;

    const diffX = targetAngleX - this.gunRotator.rotation.x;
    this.gunRotator.rotation.x += diffX * 0.15;
    // 限制俯仰角，避免翻到头顶后面
    this.gunRotator.rotation.x = T.MathUtils.clamp(
        this.gunRotator.rotation.x,
        -Math.PI / 3,   // 向下最多看这么多
        Math.PI / 6     // 向上抬一点点就够
    );
}

// 让直升机机身也缓慢朝向当前机枪目标（这一段你之前就有，只是保持）
if (this.gunTarget) {
    const heliPos = new T.Vector3();
    this.objects[0].getWorldPosition(heliPos);
    
    const targetPos = new T.Vector3();
    this.gunTarget.getWorldPosition(targetPos);
    
    const dx = targetPos.x - heliPos.x;
    const dz = targetPos.z - heliPos.z;
    const targetAngle = Math.atan2(dx, dz);
    
    const currentAngle = this.objects[0].rotation.y;
    let angleDiff = targetAngle - currentAngle;

    // 处理角度环绕，保持在 [-PI, PI]
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    this.objects[0].rotation.y += angleDiff * 0.05; // 慢慢转向
    }
    }
    
    /**
     * 设置探照灯目标
     */
    setSpotlightTarget(target) {
        this.spotlightTarget = target;
    }
    
    /**
     * 设置机枪目标
     */
    setGunTarget(target) {
        this.gunTarget = target;
    }
    
    /**
     * 检测并锁定范围内的目标
     */
    detectTargets(zombies, detectionRange = 15) {
        if (zombies.length === 0) {
            this.spotlightTarget = null;
            this.gunTarget = null;
            return;
        }
        
        const heliPos = new T.Vector3();
        this.helicopter.getWorldPosition(heliPos);
        
        let closestZombie = null;
        let minDistance = Infinity;
        
        for (const zombie of zombies) {
            const zombiePos = new T.Vector3();
            zombie.group.getWorldPosition(zombiePos);
            const distance = heliPos.distanceTo(zombiePos);
            
            if (distance < detectionRange && distance < minDistance) {
                minDistance = distance;
                closestZombie = zombie.group;
            }
        }
        
        if (closestZombie) {
            this.setSpotlightTarget(closestZombie);
            this.setGunTarget(closestZombie);
        } else {
            this.spotlightTarget = null;
            this.gunTarget = null;
        }
    }
}

DetailedHelicopter.counter = 0;