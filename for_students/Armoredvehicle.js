import * as T from "three";

/**
 * ArmoredVehicle - 装甲战车
 * 特点：
 * - 机枪炮台（可旋转）
 * - 前后装甲板
 * - 备用轮胎（后部）
 * - 前灯光
 * - 分体式挡风玻璃（上下有护甲）
 * - 侧窗护甲
 */
export class ArmoredVehicle {
    constructor(params = {}) {
        this.x = params.x || 0;
        this.z = params.z || 0;
        this.rotation = params.rotation || 0;
        this.scale = params.scale || 1;
        
        // 战车属性
        this.speed = 0;
        this.maxSpeed = 0.3;
        this.acceleration = 0.01;
        this.turnSpeed = 0.02;
        
        // 炮台属性
        this.turretRotation = 0;
        this.turretRotationSpeed = 0.03;
        this.isFiring = false;
        
        // 创建主要组
        this.group = new T.Group();
        this.group.position.set(this.x, 0, this.z);
        this.group.rotation.y = this.rotation;
        
        // 创建战车各部分
        this.createChassis();
        this.createWheels();
        this.createCabin();
        this.createWindshield();
        this.createTurret();
        this.createArmor();
        this.createSpareTires();
        this.createLights();
        
        // 添加到主组
        this.group.add(this.chassis);
        this.group.add(this.cabin);
        this.group.add(this.turretGroup);
        
        // 添加轮子
        this.wheels.forEach(wheel => this.group.add(wheel));
        
        // 整体缩放战车
        this.group.scale.set(this.scale, this.scale, this.scale);

        // 动画相关
        this.wheelRotation = 0;
    }
    
    createChassis() {
        // 底盘组
        this.chassis = new T.Group();
        
        // 主底盘
        const chassisGeo = new T.BoxGeometry(3, 1.2, 5);
        const chassisMat = new T.MeshStandardMaterial({ 
            color: 0x4a5a4a,
            metalness: 0.8,
            roughness: 0.3
        });
        const chassisMesh = new T.Mesh(chassisGeo, chassisMat);
        chassisMesh.position.y = 0.85;
        chassisMesh.position.z = -0.25;
        this.chassis.add(chassisMesh);
        
        // 底部装甲板
        const armorGeo = new T.BoxGeometry(2.8, 0.3, 4.8);
        const armorMat = new T.MeshStandardMaterial({ 
            color: 0x3a3a3a,
            metalness: 0.9,
            roughness: 0.2
        });
        const bottomArmor = new T.Mesh(armorGeo, armorMat);
        bottomArmor.position.y = 0.2;
        this.chassis.add(bottomArmor);
        
        // 前装甲板（倾斜）
        const frontArmorGeo = new T.BoxGeometry(2.2, 1.2, 0.3);
        const frontArmor = new T.Mesh(frontArmorGeo, armorMat);
        frontArmor.position.set(0, 1.2, 2.4);
        frontArmor.rotation.x = -0.3;
        this.chassis.add(frontArmor);
        
        // 后装甲板
        const rearArmorGeo = new T.BoxGeometry(3.2, 0.6, 0.45);
        const rearArmor = new T.Mesh(rearArmorGeo, armorMat);
        rearArmor.position.set(0, 0.7, -2.6);
        this.chassis.add(rearArmor);
        
        // 侧面装甲条纹
        for (let side of [-1, 1]) {
            const sideArmorGeo = new T.BoxGeometry(0.2, 0.3, 4.7);
            const sideArmor = new T.Mesh(sideArmorGeo, armorMat);
            sideArmor.position.set(side * 1.5, 0.6, -0.1);
            this.chassis.add(sideArmor);
        }
    }
    
    createWheels() {
        this.wheels = [];
        const wheelGeo = new T.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMat = new T.MeshStandardMaterial({ 
            color: 0x1a1a1a,
            metalness: 0.3,
            roughness: 0.8
        });
        
        // 轮胎花纹
        const treadGeo = new T.TorusGeometry(0.35, 0.05, 8, 16);
        const treadMat = new T.MeshStandardMaterial({ 
            color: 0x0a0a0a,
            roughness: 1
        });
        
        // 轮毂
        const hubGeo = new T.CylinderGeometry(0.2, 0.2, 0.35, 6);
        const hubMat = new T.MeshStandardMaterial({ 
            color: 0x444444,
            metalness: 0.9,
            roughness: 0.1
        });
        
        const wheelPositions = [
            { x: -1.3, z: 1.8 },  // 前左
            { x: 1.3, z: 1.8 },   // 前右
            { x: -1.3, z: -1.8 }, // 后左
            { x: 1.3, z: -1.8 }   // 后右
        ];
        
        wheelPositions.forEach(pos => {
            const wheelGroup = new T.Group();
            
            const wheel = new T.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheelGroup.add(wheel);
            
            const tread = new T.Mesh(treadGeo, treadMat);
            tread.rotation.y = Math.PI / 2;
            wheelGroup.add(tread);
            
            const hub = new T.Mesh(hubGeo, hubMat);
            hub.rotation.z = Math.PI / 2;
            wheelGroup.add(hub);
            
            wheelGroup.position.set(pos.x, 0.4, pos.z);
            this.wheels.push(wheelGroup);
        });
    }
    
    createCabin() {
        this.cabin = new T.Group();
        
        // 主驾驶舱
        const cabinGeo = new T.BoxGeometry(2.4, 1.2, 2);
        const cabinMat = new T.MeshStandardMaterial({ 
            color: 0x4a5a4a,
            metalness: 0.7,
            roughness: 0.4
        });
        const cabinMesh = new T.Mesh(cabinGeo, cabinMat);
        cabinMesh.position.set(0, 2, -1.7);
        this.cabin.add(cabinMesh);
        
          // 主驾驶舱前
        const cabinGeo2 = new T.BoxGeometry(2.4, 0.6, 2);
        const cabinMat2 = new T.MeshStandardMaterial({ 
            color: 0x4a5a4a,
            metalness: 0.7,
            roughness: 0.4
        });
        const cabinMesh2 = new T.Mesh(cabinGeo2, cabinMat2);
        cabinMesh2.position.set(0, 1.5, 1);
        this.cabin.add(cabinMesh2);

        // 顶部装甲
        const roofGeo = new T.BoxGeometry(2.5, 0.15, 4.75);
        const roofMat = new T.MeshStandardMaterial({ 
            color: 0x3a4a3a,
            metalness: 0.8,
            roughness: 0.3
        });
        const roof = new T.Mesh(roofGeo, roofMat);
        roof.position.set(0, 2.65, -0.35);
        this.cabin.add(roof);
    }
    
    createWindshield() {
        // 分体式挡风玻璃（两块）
        const glassGeo = new T.BoxGeometry(1.0, 0.7, 0.1);
        const glassMat = new T.MeshPhysicalMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.3,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.9
        });
        
        // 左玻璃
        const leftGlass = new T.Mesh(glassGeo, glassMat);
        leftGlass.position.set(-0.55, 2.2, 1.85);
        leftGlass.rotation.x = -0.2;
        this.cabin.add(leftGlass);
        
        // 右玻璃
        const rightGlass = new T.Mesh(glassGeo, glassMat);
        rightGlass.position.set(0.55, 2.2, 1.85);
        rightGlass.rotation.x = -0.2;
        this.cabin.add(rightGlass);
        
        // 中间分隔条
        const dividerGeo = new T.BoxGeometry(0.08, 0.8, 0.12);
        const dividerMat = new T.MeshStandardMaterial({ 
            color: 0x2a2a2a,
            metalness: 0.9
        });
        const divider = new T.Mesh(dividerGeo, dividerMat);
        divider.position.set(0, 2.2, 1.85);
        divider.rotation.x = -0.2;
        this.cabin.add(divider);
        
        // 上护甲
        const topArmorGeo = new T.BoxGeometry(2.1, 0.15, 0.3);
        const armorMat = new T.MeshStandardMaterial({ 
            color: 0x3a3a3a,
            metalness: 0.9,
            roughness: 0.2
        });
        const topArmor = new T.Mesh(topArmorGeo, armorMat);
        topArmor.position.set(0, 1.9, 1.8);
        topArmor.rotation.x = -0.2;
        this.cabin.add(topArmor);
        
        // 下护甲
        const bottomArmorGeo = new T.BoxGeometry(2.1, 0.6, 0.3);
        const bottomArmor = new T.Mesh(bottomArmorGeo, armorMat);
        bottomArmor.position.set(0,2.8, 1.9);
        bottomArmor.rotation.x = -0.2;
        this.cabin.add(bottomArmor);
        
        // 侧窗
        const sideGlassGeo = new T.BoxGeometry(0.1, 0.7, 2.5);
        for (let side of [-1, 1]) {
            // 侧窗玻璃
            const sideGlass = new T.Mesh(sideGlassGeo, glassMat);
            sideGlass.position.set(side * 1.25, 2.2, 0.5);
            this.cabin.add(sideGlass);
            
            // 侧窗上护甲
            const sideTopArmorGeo = new T.BoxGeometry(0.12, 0.32, 4.7);
            const sideTopArmor = new T.Mesh(sideTopArmorGeo, armorMat);
            sideTopArmor.position.set(side * 1.25, 2.7, -0.3);
            this.cabin.add(sideTopArmor);
            
            // 侧窗下护甲
            const sideDownArmorGeo = new T.BoxGeometry(0.12, 0.52, 5.2);
            const sideBottomArmor = new T.Mesh(sideDownArmorGeo, armorMat);
            sideBottomArmor.position.set(side * 1.25, 1.7, -0.1);
            this.cabin.add(sideBottomArmor);
        }
    }
    
    createTurret() {
        this.turretGroup = new T.Group();
        this.turretGroup.position.set(0, 2.0, -0.3);
        
        // 炮塔底座
        const baseGeo = new T.CylinderGeometry(0.6, 0.7, 0.3, 16);
        const baseMat = new T.MeshStandardMaterial({ 
            color: 0x3a4a3a,
            metalness: 0.8,
            roughness: 0.3
        });
        const base = new T.Mesh(baseGeo, baseMat);
        base.position.y = 1;
        this.turretGroup.add(base);
        
        // 旋转部分
        this.turretRotatingPart = new T.Group();
        this.turretRotatingPart.position.y = 1.15;
        this.turretGroup.add(this.turretRotatingPart);
        
        // 炮塔主体
        const turretBodyGeo = new T.CylinderGeometry(0.5, 0.5, 0.4, 8);
        const turretMat = new T.MeshStandardMaterial({ 
            color: 0x4a5a4a,
            metalness: 0.7,
            roughness: 0.4
        });
        const turretBody = new T.Mesh(turretBodyGeo, turretMat);
        turretBody.position.y = 0.2;
        this.turretRotatingPart.add(turretBody);
        
        // 机枪主体
        const gunBodyGeo = new T.BoxGeometry(0.4, 0.4, 1.6);
        const gunMat = new T.MeshStandardMaterial({ 
            color: 0x2a2a2a,
            metalness: 0.9,
            roughness: 0.2
        });
        const gunBody = new T.Mesh(gunBodyGeo, gunMat);
        gunBody.position.set(0, 0.35, 0.5);
        this.turretRotatingPart.add(gunBody);
        
        // 枪管
        const barrelGeo = new T.CylinderGeometry(0.12, 0.12, 2.4, 32);
        const barrelMat = new T.MeshStandardMaterial({ 
            color: 0x1a1a1a,
            metalness: 0.95,
            roughness: 0.1
        });
        const barrel = new T.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.35, 1.3);
        this.turretRotatingPart.add(barrel);
        
        // 枪口
        const muzzleGeo = new T.CylinderGeometry(0.12, 0.12, 0.32, 32);
        const muzzle = new T.Mesh(muzzleGeo, barrelMat);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, 0.35, 1.95);
        this.turretRotatingPart.add(muzzle);
        
        // 弹药箱
        const ammoBoxGeo = new T.BoxGeometry(0.5, 0.3, 0.6);
        const ammoBox = new T.Mesh(ammoBoxGeo, turretMat);
        ammoBox.position.set(0.3, 0.3, 0.2);
        this.turretRotatingPart.add(ammoBox);
        
        // 瞄准镜
        const sightGeo = new T.BoxGeometry(0.16, 0.16, 0.3);
        const sight = new T.Mesh(sightGeo, gunMat);
        sight.position.set(0, 0.45, 0.5);
        this.turretRotatingPart.add(sight);
    }
    
    createArmor() {
        // 额外装甲板（装饰性）
        const plateGeo = new T.BoxGeometry(0.4, 0.5, 0.05);
        const plateMat = new T.MeshStandardMaterial({ 
            color: 0x4a4a4a,
            metalness: 0.8,
            roughness: 0.4
        });
        
        // 前侧装甲板
        for (let side of [-1, 1]) {
            const plate = new T.Mesh(plateGeo, plateMat);
            plate.position.set(side * 1.4, 0.5, 2.65);// ----------------
            plate.rotation.y = side * 0.3;
            this.cabin.add(plate);
        }
         // 装甲铆钉
        const rivetGeo = new T.SphereGeometry(0.03, 8, 8);
        const rivetMat = new T.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.9
        });
        
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 3; j++) {
                const rivet = new T.Mesh(rivetGeo, rivetMat);
                rivet.position.set(
                    -1.05 + i * 0.3,
                    1.75 + j * 0.3,
                    -2.7
                );
                this.cabin.add(rivet);
            }
        }
     
    }
    
    createSpareTires() {
      
    }
    
    createLights() {
        // 前大灯
        const lightGeo = new T.CylinderGeometry(0.15, 0.18, 0.2, 16);
        const lightHousingMat = new T.MeshStandardMaterial({ 
            color: 0x2a2a2a,
            metalness: 0.9,
            roughness: 0.2
        });
        const lightGlassMat = new T.MeshPhysicalMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.8,
            metalness: 0.1,
            roughness: 0.1,
            emissive: 0xffff88,
            emissiveIntensity: 0.5
        });
        
        const lightPositions = [
            { x: -1.2, z: 2.5 },
            { x: 1.2, z: 2.5 }
        ];
        
        this.spotLights = [];
        
        lightPositions.forEach(pos => {
            const lightGroup = new T.Group();
            
            // 灯壳
            const housing = new T.Mesh(lightGeo, lightHousingMat);
            housing.rotation.x = Math.PI / 2;
            lightGroup.add(housing);
            
            // 灯玻璃
            const glassGeo = new T.CylinderGeometry(0.14, 0.16, 0.05, 16);
            const glass = new T.Mesh(glassGeo, lightGlassMat);
            glass.rotation.x = Math.PI / 2;
            glass.position.z = 0.12;
            lightGroup.add(glass);
            
            // 实际光源
            const spotLight = new T.SpotLight(0xffffdd, 2, 15, Math.PI / 6, 0.5);
            spotLight.position.set(0, 0, 0.15);
            spotLight.target.position.set(0, 0, 5);
            lightGroup.add(spotLight);
            lightGroup.add(spotLight.target);
            
            lightGroup.position.set(pos.x, 0.9, pos.z);
            this.chassis.add(lightGroup);
            
            this.spotLights.push(spotLight);
        });
        
        // 顶部警示灯
        const warningLightGeo = new T.CylinderGeometry(0.2, 0.24, 0.3, 16);
        const warningLightMat = new T.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.8,
            metalness: 0.3,
            roughness: 0.7
        });
        const warningLight = new T.Mesh(warningLightGeo, warningLightMat);
        warningLight.position.set(0, 0.8, -1.5);
        this.turretGroup.add(warningLight);
    }
    
    // 更新炮台朝向
    rotateTurret(direction) {
        // direction: 1 for right, -1 for left
        this.turretRotation += direction * this.turretRotationSpeed;
        this.turretRotatingPart.rotation.y = this.turretRotation;
    }
    
    // 移动战车
    move(forward, turn) {
        if (forward !== 0) {
            this.speed += forward * this.acceleration;
            this.speed = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.speed));
        } else {
            this.speed *= 0.95; // 摩擦力
        }
        
        if (turn !== 0 && Math.abs(this.speed) > 0.01) {
            this.rotation += turn * this.turnSpeed * (this.speed / this.maxSpeed);
            this.group.rotation.y = this.rotation;
        }
        
        // 更新位置
        this.x += Math.sin(this.rotation) * this.speed;
        this.z += Math.cos(this.rotation) * this.speed;
        this.group.position.set(this.x, 0, this.z);
        
        // 轮子动画
        this.wheelRotation += this.speed * 2;
        this.wheels.forEach(wheel => {
            wheel.rotation.x = this.wheelRotation;
        });
    }
    
    // 获取炮口位置（用于发射子弹）
    getMuzzlePosition() {
        const muzzleLocal = new T.Vector3(0, 0.35, 1.95);
        
        // 转换到世界坐标
        this.turretRotatingPart.updateMatrixWorld();
        const muzzleWorld = muzzleLocal.applyMatrix4(this.turretRotatingPart.matrixWorld);
        
        return muzzleWorld;
    }
    
    // 获取炮口方向
    getMuzzleDirection() {
        const direction = new T.Vector3(0, 0, 1);
        
        // 应用旋转
        direction.applyAxisAngle(new T.Vector3(0, 1, 0), this.rotation + this.turretRotation);
        
        return direction.normalize();
    }
    
    // 开火效果
    fire() {
        this.isFiring = true;
        
        // 后坐力效果
        const originalZ = this.turretRotatingPart.children[2].position.z;
        this.turretRotatingPart.children[2].position.z -= 0.1;
        
        setTimeout(() => {
            this.turretRotatingPart.children[2].position.z = originalZ;
            this.isFiring = false;
        }, 100);
    }
    
    update(deltaTime) {
        // 可以在这里添加额外的动画
        // 例如警示灯闪烁等
    }
}