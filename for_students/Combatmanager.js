import * as T from "three";

/**
 * CombatManager.js
 * 统一管理：
 * - 基地炮塔
 * - 直升机
 * - 战车
 * 的目标选择、开火、伤害结算和简单的子弹特效（激光线 + 枪口火光）
 */
export class CombatManager {
    constructor(world, config = {}) {
        this.world = world;

        // 伤害 & 经济配置
        this.TURRET_DAMAGE = config.TURRET_DAMAGE || 50;
        this.HELI_DAMAGE = config.HELI_DAMAGE || 30;
        this.VEHICLE_DAMAGE = config.VEHICLE_DAMAGE || 80;
        this.ZOMBIE_GOLD_REWARD = config.ZOMBIE_GOLD_REWARD || 30;
        this.BASE_RADIUS = config.BASE_RADIUS || 2.8;

        // 冷却、射程
        this.TURRET_FIRE_INTERVAL = 30;
        this.HELI_FIRE_INTERVAL = 20;
        this.VEHICLE_FIRE_INTERVAL = 25;

        this.TURRET_RANGE = 20;
        this.HELI_RANGE = 15;
        this.VEHICLE_RANGE = 18;

        // 公共特效
        this.bullets = [];
        this.muzzleFlashes = [];

        // 直升机状态
        this.heliAttackTimers = [];

        // 战车状态
        this.vehicle = null;
        this.vehicleTargetZombie = null;
        this.vehicleFireCooldown = 0;

        // 统计
        this.totalKills = 0;
        this.playerGold = 0;
    }

    setVehicle(vehicle) {
        this.vehicle = vehicle;
    }
    setPlayerGold(gold) {
        this.playerGold = gold;
    }
    getPlayerGold() {
        return this.playerGold;
    }
    getTotalKills() {
        return this.totalKills;
    }

    // ========== 通用：激光 子弹网格 ==========
    createBullet(startPos, endPos, color = 0xffff00) {
        const dir = new T.Vector3().subVectors(endPos, startPos);
        const dist = dir.length() || 0.0001;

        const geo = new T.CylinderGeometry(0.05, 0.05, dist, 8);
        const mat = new T.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.9
        });

        const mesh = new T.Mesh(geo, mat);
        mesh.position.copy(startPos).add(dir.multiplyScalar(0.5));
        mesh.quaternion.setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            dir.normalize()
        );

        mesh.lifetime = 8;
        this.world.scene.add(mesh);
        this.bullets.push(mesh);
        return mesh;
    }

    createMuzzleFlash(position) {
        const geo = new T.SphereGeometry(0.3, 8, 8);
        const mat = new T.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xffaa00,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 1.0
        });

        const flash = new T.Mesh(geo, mat);
        flash.position.copy(position);
        flash.lifetime = 5;

        this.world.scene.add(flash);
        this.muzzleFlashes.push(flash);
        return flash;
    }

    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.lifetime--;
            b.material.opacity = b.lifetime / 8;
            if (b.lifetime <= 0) {
                this.world.scene.remove(b);
                this.bullets.splice(i, 1);
            }
        }
    }

    updateMuzzleFlashes() {
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const f = this.muzzleFlashes[i];
            f.lifetime--;
            f.material.opacity = f.lifetime / 5;
            f.scale.multiplyScalar(1.15);
            if (f.lifetime <= 0) {
                this.world.scene.remove(f);
                this.muzzleFlashes.splice(i, 1);
            }
        }
    }

    // ========== 炮塔 ==========
    updateTurretTargeting(turret, zombies) {
        if (!turret) return;

        let closest = null;
        let closestObj = null;
        let minDist = this.TURRET_RANGE;

        const turretPos = new T.Vector3(0, 1.8, 0); // 炮塔在世界里的位置

        for (const z of zombies) {
            if (!z.isAlive || !z.isAlive()) continue;
            const zp = new T.Vector3();
            z.group.getWorldPosition(zp);
            const d = turretPos.distanceTo(zp);
            if (d < minDist) {
                minDist = d;
                closest = z.group;
                closestObj = z;
            }
        }

        turret.target = closest;
        turret.targetZombie = closestObj;

        if (closest) {
            const targetPos = new T.Vector3();
            closest.getWorldPosition(targetPos);

            const dx = targetPos.x - turretPos.x;
            const dz = targetPos.z - turretPos.z;
            const angle = Math.atan2(dx, dz);

            turret.rotator.rotation.y = angle;
            //turret.laser.visible = true;//disabled
        } else {
            //turret.laser.visible = false;//disabled
            turret.fireTimer = 0;
        }
    }

    turretAttack(turret, zombies) {
        if (!turret || !turret.targetZombie) {
            if (turret) turret.fireTimer = 0;
            return;
        }
        if (!turret.targetZombie.isAlive || !turret.targetZombie.isAlive()) {
            turret.targetZombie = null;
            turret.target = null;
            //turret.laser.visible = false;//disabled
            turret.fireTimer = 0;
            return;
        }

        if (!turret.fireTimer) turret.fireTimer = 0;
        turret.fireTimer++;

        if (turret.fireTimer >= this.TURRET_FIRE_INTERVAL) {
            turret.fireTimer = 0;

            const muzzlePos = new T.Vector3(1.2, 1.8, 0);
            turret.rotator.localToWorld(muzzlePos);

            const targetPos = new T.Vector3();
            turret.targetZombie.group.getWorldPosition(targetPos);
            targetPos.y += 1;

            this.createBullet(muzzlePos, targetPos, 0xffff00);
            this.createMuzzleFlash(muzzlePos);

            const died = turret.targetZombie.takeDamage(this.TURRET_DAMAGE);
            if (died) {
                const idx = zombies.indexOf(turret.targetZombie);
                if (idx !== -1) {
                    this.world.scene.remove(zombies[idx].group);
                    zombies.splice(idx, 1);
                    this.playerGold += this.ZOMBIE_GOLD_REWARD;
                    this.totalKills++;
                }
                turret.targetZombie = null;
                turret.target = null;
                //turret.laser.visible = false;//disabled
            }
        }
    }

    // ========== 直升机 ==========
    updateHelicopterTargeting(helicopters, zombies) {
        helicopters.forEach((heli, index) => {
            if (!this.heliAttackTimers[index]) this.heliAttackTimers[index] = 0;
            heli.detectTargets(zombies, this.HELI_RANGE);
        });
    }

    helicopterAttack(helicopters, zombies) {
        helicopters.forEach((heli, index) => {
            if (!this.heliAttackTimers[index]) this.heliAttackTimers[index] = 0;

            if (heli.gunTarget) {
                let targetZombie = null;
                for (const z of zombies) {
                    if (z.group === heli.gunTarget) {
                        targetZombie = z;
                        break;
                    }
                }

                if (targetZombie && targetZombie.isAlive && targetZombie.isAlive()) {
                    this.heliAttackTimers[index]++;

                    if (this.heliAttackTimers[index] >= this.HELI_FIRE_INTERVAL) {
                        this.heliAttackTimers[index] = 0;

                        const gunPos = new T.Vector3();
                        heli.gunRotator.getWorldPosition(gunPos);

                        const targetPos = new T.Vector3();
                        targetZombie.group.getWorldPosition(targetPos);
                        targetPos.y += 1;

                        this.createBullet(gunPos, targetPos, 0xff8800);
                        this.createMuzzleFlash(gunPos);

                        const died = targetZombie.takeDamage(this.HELI_DAMAGE);
                        if (died) {
                            const idxZ = zombies.indexOf(targetZombie);
                            if (idxZ !== -1) {
                                this.world.scene.remove(zombies[idxZ].group);
                                zombies.splice(idxZ, 1);
                                this.playerGold += this.ZOMBIE_GOLD_REWARD;
                                this.totalKills++;
                            }
                            heli.gunTarget = null;
                            heli.spotlightTarget = null;
                        }
                    }
                } else {
                    this.heliAttackTimers[index] = 0;
                    heli.gunTarget = null;
                    heli.spotlightTarget = null;
                }
            } else {
                this.heliAttackTimers[index] = 0;
            }
        });
    }

    // ========== 战车：改成“像炮塔一样”的激光射击 ==========
    updateVehicleTargeting(zombies) {
        if (!this.vehicle || zombies.length === 0) {
            this.vehicleTargetZombie = null;
            this.vehicleFireCooldown = 0;
            return;
        }

        const vehiclePos = new T.Vector3();
        this.vehicle.group.getWorldPosition(vehiclePos);

        let closestZombie = null;
        let closestDistance = this.VEHICLE_RANGE;

        for (const z of zombies) {
            if (!z.isAlive || !z.isAlive()) continue;

            const zp = new T.Vector3();
            z.group.getWorldPosition(zp);
            const d = vehiclePos.distanceTo(zp);

            if (d < closestDistance) {
                closestDistance = d;
                closestZombie = z;
            }
        }

        this.vehicleTargetZombie = closestZombie;

        if (this.vehicleTargetZombie) {
    const zombiePos = new T.Vector3();
    this.vehicleTargetZombie.group.getWorldPosition(zombiePos);

    const dx = zombiePos.x - vehiclePos.x;
    const dz = zombiePos.z - vehiclePos.z;
    const targetAngle = Math.atan2(dx, dz);

    // ✅ 当前炮塔在世界里的朝向 = 车身 + 炮塔相对车身的角度
    let currentTurretWorldAngle = this.vehicle.rotation + this.vehicle.turretRotation;

    // 期望角度差 = 目标角度 - 当前炮塔世界角度
    let angleDiff = targetAngle - currentTurretWorldAngle;

    // 把角度差规约到 [-PI, PI]，避免走“长路”
    angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;

    // 使用一点“插值”让它慢慢转过去，而不是直接跳
    const ROTATE_SPEED = 0.15; // 可以调大/调小试试
    this.vehicle.turretRotation += angleDiff * ROTATE_SPEED;

    // 实际应用到模型
    this.vehicle.turretRotatingPart.rotation.y = this.vehicle.turretRotation;

    // 可选：如果已经很接近了，直接对齐，防止抖动
    if (Math.abs(angleDiff) < 0.005) {
        this.vehicle.turretRotation += angleDiff;
        this.vehicle.turretRotatingPart.rotation.y = this.vehicle.turretRotation;
    }

    // 后面开火逻辑保持不变
    if (this.vehicleFireCooldown > 0) {
        this.vehicleFireCooldown--;
    } else {
        this.vehicleFireCooldown = this.VEHICLE_FIRE_INTERVAL;
        this.vehicleFireLikeTurret(zombies);
    }
} else {
    this.vehicleFireCooldown = 0;
}
    }

    /**
     * 战车开火行为：类似基地炮塔
     * - 立即从炮口连一条激光到僵尸
     * - 直接结算伤害
     */
    vehicleFireLikeTurret(zombies) {
        if (!this.vehicle || !this.vehicleTargetZombie) return;
        if (!this.vehicleTargetZombie.isAlive || !this.vehicleTargetZombie.isAlive()) {
            this.vehicleTargetZombie = null;
            return;
        }

        // 触发战车自身的后坐力动画
        this.vehicle.fire();

        // 炮口世界坐标
        const muzzlePos = this.vehicle.getMuzzlePosition();

        // 目标位置
        const targetPos = new T.Vector3();
        this.vehicleTargetZombie.group.getWorldPosition(targetPos);
        targetPos.y += 1;

        // 画出“激光弹道”和火光
        this.createBullet(muzzlePos, targetPos, 0xffff00);
        this.createMuzzleFlash(muzzlePos);

        // 直接结算伤害（类似 turretAttack）
        const died = this.vehicleTargetZombie.takeDamage(this.VEHICLE_DAMAGE);
        if (died) {
            const idx = zombies.indexOf(this.vehicleTargetZombie);
            if (idx !== -1) {
                this.world.scene.remove(zombies[idx].group);
                zombies.splice(idx, 1);
                this.playerGold += this.ZOMBIE_GOLD_REWARD;
                this.totalKills++;
            }
            this.vehicleTargetZombie = null;
        }
    }

    // ========== 僵尸撞基地 ==========
    checkBaseCollisions(zombies, baseHealth, hearts, onDamage, onGameOver) {
        const basePos = new T.Vector3(0, 0, 0);

        for (let i = zombies.length - 1; i >= 0; i--) {
            const z = zombies[i];
            if (!z.isAlive || !z.isAlive()) continue;

            const zp = new T.Vector3();
            z.group.getWorldPosition(zp);
            const d = basePos.distanceTo(zp);

            if (d < this.BASE_RADIUS) {
                this.world.scene.remove(z.group);
                zombies.splice(i, 1);

                baseHealth--;
                if (hearts[baseHealth]) {
                    hearts[baseHealth].visible = false;
                }

                if (onDamage) onDamage(baseHealth);

                if (baseHealth <= 0 && onGameOver) {
                    onGameOver();
                    return baseHealth;
                }
            }
        }
        return baseHealth;
    }

    // ========== 总 update ==========
    update(turret, helicopters, zombies, baseHealth, hearts, onDamageCallback, onGameOverCallback) {
        // 炮塔
        this.updateTurretTargeting(turret, zombies);
        this.turretAttack(turret, zombies);

        // 直升机
        this.updateHelicopterTargeting(helicopters, zombies);
        this.helicopterAttack(helicopters, zombies);

        // 战车
        if (this.vehicle) {
            this.updateVehicleTargeting(zombies);
        }

        // 公共特效
        this.updateBullets();
        this.updateMuzzleFlashes();

        // 僵尸与基地碰撞
        baseHealth = this.checkBaseCollisions(
            zombies,
            baseHealth,
            hearts,
            onDamageCallback,
            onGameOverCallback
        );

        return baseHealth;
    }
}
