/*jshint esversion: 6 */
// @ts-check

import * as T from "../libs/CS559-Three/build/three.module.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";

/**
 * 全局共享的姿态检测器
 */
let sharedDetector = null;
let detectorInitializing = false;
let poseModelType = null; // 'blazepose' or 'movenet'
let poseDebug = false; // Set true during debugging; toggles console logs inside applyPoseToModel

async function initSharedDetector() {
    if (sharedDetector) return sharedDetector;
    if (detectorInitializing) {
        while (detectorInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return sharedDetector;
    }
    
    detectorInitializing = true;
    
    try {
        // Try BlazePose (MediaPipe) first — use a safe solution path without a long version
        const modelBP = poseDetection.SupportedModels.BlazePose;
        const detectorConfigBP = {
            runtime: 'mediapipe',
            // Use the canonical CDN path for mediapipe pose; some versions don't expose the Pose constructor
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
            modelType: 'lite',
            enableSmoothing: true
        };

        try {
            sharedDetector = await poseDetection.createDetector(modelBP, detectorConfigBP);
            poseModelType = 'blazepose';
            console.log('✓ Shared pose detector initialized (BlazePose / MediaPipe)');
            return sharedDetector;
        } catch (bpError) {
            console.warn('BlazePose (MediaPipe) detector initialization failed:', bpError);
            // fall through and try a tfjs model (MoveNet)
        }

        // Fallback: try MoveNet with TFJS runtime if BlazePose fails
        const modelMT = poseDetection.SupportedModels.MoveNet;
        const detectorConfigMT = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        sharedDetector = await poseDetection.createDetector(modelMT, detectorConfigMT);
        poseModelType = 'movenet';
        console.log('✓ Shared pose detector initialized (MoveNet / TFJS)');
        return sharedDetector;
        
    } catch (error) {
        console.error('Failed to initialize shared detector:', error);
        throw error;
    } finally {
        detectorInitializing = false;
    }
}

/**
 * 丧尸类 - 3D模型 + 骨骼动画
 */
export class Zombie extends GrObject {
    constructor(params = {}) {
        let zombieGroup = new T.Group();
        super(`Zombie-${Zombie.counter++}`, zombieGroup);
        
        this.group = zombieGroup;
        this.targetPosition = new T.Vector3(0, 0, 0);
        this.speed = params.speed || 0.02;
        this.video = params.video;
        
     // 血量系统（支持自定义）
    this.maxHealth = params.health || 100;
    this.health = this.maxHealth;
    this.isDead = false;
        
        // 骨骼部件
        this.bones = {};
        
        // 初始位置
        zombieGroup.position.set(
            params.x || (Math.random() - 0.5) * 20,
            0,
            params.z || (Math.random() - 0.5) * 20
        );
        
        // 创建丧尸模型
        this.createZombieModel();
        
        console.log(`✓ Zombie created with health: ${this.health}`);
    }
    
    /**
     * 创建丧尸3D模型
     */
    createZombieModel() {
        // 材质定义
        const skinMaterial = new T.MeshStandardMaterial({
            color: 0x44aa44,
            emissive: 0x112211,
            emissiveIntensity: 0.3,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const clothesMaterial = new T.MeshStandardMaterial({
            color: 0x336633,
            roughness: 0.9,
            metalness: 0.0
        });
        
        const eyeMaterial = new T.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.9
        });
        
        // 根骨骼（髋部）
        this.bones.hips = new T.Group();
        this.group.add(this.bones.hips);
        
        // 躯干
        const torsoGeo = new T.CylinderGeometry(0.25, 0.28, 0.7, 12);
        const torso = new T.Mesh(torsoGeo, clothesMaterial);
        torso.position.y = 0.35;
        this.bones.hips.add(torso);
        
        // 头部
        this.bones.neck = new T.Group();
        this.bones.neck.position.y = 0.7;
        this.bones.hips.add(this.bones.neck);
        
        const headGeo = new T.SphereGeometry(0.25, 16, 16);
        const head = new T.Mesh(headGeo, skinMaterial);
        head.position.y = 0.25;
        this.bones.neck.add(head);
        
        // 眼睛
        const eyeGeo = new T.SphereGeometry(0.06, 12, 12);
        this.leftEye = new T.Mesh(eyeGeo, eyeMaterial);
        this.leftEye.position.set(0.1, 0.3, 0.2);
        this.bones.neck.add(this.leftEye);
        
        this.rightEye = new T.Mesh(eyeGeo, eyeMaterial);
        this.rightEye.position.set(-0.1, 0.3, 0.2);
        this.bones.neck.add(this.rightEye);
        
        const leftLight = new T.PointLight(0xff0000, 0.5, 2);
        leftLight.position.copy(this.leftEye.position);
        this.bones.neck.add(leftLight);
        
        const rightLight = new T.PointLight(0xff0000, 0.5, 2);
        rightLight.position.copy(this.rightEye.position);
        this.bones.neck.add(rightLight);
        
        // 左臂
        this.bones.leftUpperArm = new T.Group();
        this.bones.leftUpperArm.position.set(0.3, 0.6, 0);
        this.bones.hips.add(this.bones.leftUpperArm);
        
        const upperArmGeo = new T.CylinderGeometry(0.08, 0.08, 0.4, 8);
        const leftUpperArmMesh = new T.Mesh(upperArmGeo, skinMaterial);
        leftUpperArmMesh.position.y = -0.2;
        this.bones.leftUpperArm.add(leftUpperArmMesh);
        
        this.bones.leftLowerArm = new T.Group();
        this.bones.leftLowerArm.position.y = -0.4;
        this.bones.leftUpperArm.add(this.bones.leftLowerArm);
        
        const lowerArmGeo = new T.CylinderGeometry(0.07, 0.06, 0.35, 8);
        const leftLowerArmMesh = new T.Mesh(lowerArmGeo, skinMaterial);
        leftLowerArmMesh.position.y = -0.175;
        this.bones.leftLowerArm.add(leftLowerArmMesh);
        
        const handGeo = new T.SphereGeometry(0.08, 12, 12);
        const leftHand = new T.Mesh(handGeo, skinMaterial);
        leftHand.position.y = -0.35;
        this.bones.leftLowerArm.add(leftHand);
        
        // 右臂
        this.bones.rightUpperArm = new T.Group();
        this.bones.rightUpperArm.position.set(-0.3, 0.6, 0);
        this.bones.hips.add(this.bones.rightUpperArm);
        
        const rightUpperArmMesh = new T.Mesh(upperArmGeo, skinMaterial);
        rightUpperArmMesh.position.y = -0.2;
        this.bones.rightUpperArm.add(rightUpperArmMesh);
        
        this.bones.rightLowerArm = new T.Group();
        this.bones.rightLowerArm.position.y = -0.4;
        this.bones.rightUpperArm.add(this.bones.rightLowerArm);
        
        const rightLowerArmMesh = new T.Mesh(lowerArmGeo, skinMaterial);
        rightLowerArmMesh.position.y = -0.175;
        this.bones.rightLowerArm.add(rightLowerArmMesh);
        
        const rightHand = new T.Mesh(handGeo, skinMaterial);
        rightHand.position.y = -0.35;
        this.bones.rightLowerArm.add(rightHand);
        
        // 左腿
        this.bones.leftUpperLeg = new T.Group();
        this.bones.leftUpperLeg.position.set(0.12, 0, 0);
        this.bones.hips.add(this.bones.leftUpperLeg);
        
        const thighGeo = new T.CylinderGeometry(0.1, 0.09, 0.45, 10);
        const leftThigh = new T.Mesh(thighGeo, clothesMaterial);
        leftThigh.position.y = -0.225;
        this.bones.leftUpperLeg.add(leftThigh);
        
        this.bones.leftLowerLeg = new T.Group();
        this.bones.leftLowerLeg.position.y = -0.45;
        this.bones.leftUpperLeg.add(this.bones.leftLowerLeg);
        
        const calfGeo = new T.CylinderGeometry(0.08, 0.07, 0.4, 10);
        const leftCalf = new T.Mesh(calfGeo, skinMaterial);
        leftCalf.position.y = -0.2;
        this.bones.leftLowerLeg.add(leftCalf);
        
        const footGeo = new T.BoxGeometry(0.12, 0.08, 0.25);
        const leftFoot = new T.Mesh(footGeo, clothesMaterial);
        leftFoot.position.set(0, -0.4, 0.05);
        this.bones.leftLowerLeg.add(leftFoot);
        
        // 右腿
        this.bones.rightUpperLeg = new T.Group();
        this.bones.rightUpperLeg.position.set(-0.12, 0, 0);
        this.bones.hips.add(this.bones.rightUpperLeg);
        
        const rightThigh = new T.Mesh(thighGeo, clothesMaterial);
        rightThigh.position.y = -0.225;
        this.bones.rightUpperLeg.add(rightThigh);
        
        this.bones.rightLowerLeg = new T.Group();
        this.bones.rightLowerLeg.position.y = -0.45;
        this.bones.rightUpperLeg.add(this.bones.rightLowerLeg);
        
        const rightCalf = new T.Mesh(calfGeo, skinMaterial);
        rightCalf.position.y = -0.2;
        this.bones.rightLowerLeg.add(rightCalf);
        
        const rightFoot = new T.Mesh(footGeo, clothesMaterial);
        rightFoot.position.set(0, -0.4, 0.05);
        this.bones.rightLowerLeg.add(rightFoot);
    }
    
    /**
     * 应用姿态到模型
     */
    applyPoseToModel(pose) {
        if (!pose || !pose.keypoints) return;
        // Ensure model/canvas visible (sometimes off by default)
        if (this.group && !this.group.visible) this.group.visible = true;
        
        const kp = pose.keypoints;
        const SCALE = 0.005;
        const VIDEO_WIDTH = this.video.videoWidth || 640;
        const VIDEO_HEIGHT = this.video.videoHeight || 480;
        const CENTER_X = VIDEO_WIDTH / 2;
        const CENTER_Y = VIDEO_HEIGHT / 2;
        // helper: attempt to find a keypoint by name, part, or label (works for different detectors)
        const findKeypointByName = (name) => {
            if (!kp) return null;
            for (let i = 0; i < kp.length; i++) {
                const k = kp[i];
                if (!k) continue;
                if (k.name === name || k.part === name || k.label === name) return k;
            }
            return null;
        };

        // generic getter: tries to find keypoint by a canonical name; if not found, falls back to index depending on model
        const getPosBy = (name, blazeIndex, moveIndex) => {
            let p = findKeypointByName(name);
            if (!p) {
                const idx = (poseModelType === 'movenet' ? moveIndex : blazeIndex);
                p = kp[idx];
            }
            if (!p || (typeof p.score === 'number' && p.score < 0.3)) return null;
            // Some detectors return normalized coordinates (0..1); map to pixel coords when needed
            let px = p.x;
            let py = p.y;
            if (px <= 1 && py <= 1) {
                px = px * VIDEO_WIDTH;
                py = py * VIDEO_HEIGHT;
            }
            // compute z: prefer provided z if present; otherwise use a function of Y
            let pz = 0;
            if (typeof p.z !== 'undefined' && p.z !== null) {
                // If z appears normalized, scale it roughly to world units (invert if needed)
                pz = (typeof p.z === 'number') ? (p.z * 1.0) : 0;
            } else {
                // fallback: map vertical position to depth so feet are nearer, head farther
                const normalizedY = (py - CENTER_Y) / CENTER_Y; // -1..1
                pz = normalizedY * 0.5; // scale factor for depth
            }
            return new T.Vector3(
                (px - CENTER_X) * SCALE,
                -(py - CENTER_Y) * SCALE + 1.5,
                pz
            );
        };
        
        const getRotation = (p1, p2) => {
            if (!p1 || !p2) return 0;
            return Math.atan2(p2.x - p1.x, p1.y - p2.y);
        };
        
        const leftHip = getPosBy('left_hip', 23, 11);
        const rightHip = getPosBy('right_hip', 24, 12);
        let hipCenter = null;
        if (leftHip && rightHip) {
            hipCenter = new T.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
            this.bones.hips.position.copy(hipCenter);
        }
        
        const nose = getPosBy('nose', 0, 0);
        const leftShoulder = getPosBy('left_shoulder', 11, 5);
        const rightShoulder = getPosBy('right_shoulder', 12, 6);
        if (nose && leftShoulder && rightShoulder) {
            const shoulderCenter = new T.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
            const tilt = (nose.x - shoulderCenter.x) * 0.5;
            this.bones.neck.rotation.z = tilt;
        }
        
        const leftElbow = getPosBy('left_elbow', 13, 7);
        const leftWrist = getPosBy('left_wrist', 15, 9);
        
        // Simple rotation-based bone orientation (compatible with the workbook version)
        if (leftShoulder && leftElbow) {
            const theta = getRotation(leftShoulder, leftElbow);
            this.bones.leftUpperArm.rotation.z = theta;
            this.bones.leftUpperArm.rotation.x = theta * 0.25;
        }

        if (leftElbow && leftWrist) {
            const elbowAngle = getRotation(leftElbow, leftWrist);
            const shoulderAngle = this.bones.leftUpperArm.rotation.z || 0;
            const lowerTheta = elbowAngle - shoulderAngle;
            this.bones.leftLowerArm.rotation.z = lowerTheta;
            this.bones.leftLowerArm.rotation.x = lowerTheta * 0.25;
        }
        
        const rightElbow = getPosBy('right_elbow', 14, 8);
        const rightWrist = getPosBy('right_wrist', 16, 10);

        if (poseDebug && (leftShoulder || rightShoulder)) {
            console.log(`🔍 applyPoseToModel: lS:${!!leftShoulder} lE:${!!leftElbow} lW:${!!leftWrist} rS:${!!rightShoulder} rE:${!!rightElbow} rW:${!!rightWrist} lH:${!!leftHip} rH:${!!rightHip}`);
        }
        
        if (rightShoulder && rightElbow) {
            const theta = getRotation(rightShoulder, rightElbow);
            this.bones.rightUpperArm.rotation.z = theta;
            this.bones.rightUpperArm.rotation.x = theta * 0.25;
        }

        if (rightElbow && rightWrist) {
            const elbowAngle = getRotation(rightElbow, rightWrist);
            const shoulderAngle = this.bones.rightUpperArm.rotation.z || 0;
            const lowerTheta = elbowAngle - shoulderAngle;
            this.bones.rightLowerArm.rotation.z = lowerTheta;
            this.bones.rightLowerArm.rotation.x = lowerTheta * 0.25;
        }
        
        const leftKnee = getPosBy('left_knee', 25, 13);
        const leftAnkle = getPosBy('left_ankle', 27, 15);
        
        if (leftHip && leftKnee) {
            const theta = getRotation(leftHip, leftKnee);
            this.bones.leftUpperLeg.rotation.z = theta;
            this.bones.leftUpperLeg.rotation.x = theta * 0.15;
        }

        if (leftKnee && leftAnkle) {
            const kneeAngle = getRotation(leftKnee, leftAnkle);
            const hipAngle = this.bones.leftUpperLeg.rotation.z || 0;
            const lowerTheta = kneeAngle - hipAngle;
            this.bones.leftLowerLeg.rotation.z = lowerTheta;
            this.bones.leftLowerLeg.rotation.x = lowerTheta * 0.15;
        }
        
        const rightKnee = getPosBy('right_knee', 26, 14);
        const rightAnkle = getPosBy('right_ankle', 28, 16);
        
        if (rightHip && rightKnee) {
            const theta = getRotation(rightHip, rightKnee);
            this.bones.rightUpperLeg.rotation.z = theta;
            this.bones.rightUpperLeg.rotation.x = theta * 0.15;
        }

        if (rightKnee && rightAnkle) {
            const kneeAngle = getRotation(rightKnee, rightAnkle);
            const hipAngle = this.bones.rightUpperLeg.rotation.z || 0;
            const lowerTheta = kneeAngle - hipAngle;
            this.bones.rightLowerLeg.rotation.z = lowerTheta;
            this.bones.rightLowerLeg.rotation.x = lowerTheta * 0.15;
        }
        
        // If no nose/shoulders detected, apply a small idle neck rotation
        if (!(nose && leftShoulder && rightShoulder)) {
            this.bones.neck.rotation.x = Math.sin(Date.now() * 0.003) * 0.05;
        }
    }
    
    /**
     * 受到伤害
     */
    takeDamage(damage) {
        if (this.isDead) {
            console.log(`⚠️ Zombie already dead, ignoring damage`);
            return false;
        }
        
        this.health -= damage;
        console.log(`💔 Zombie took ${damage} damage, health: ${this.health}/${this.maxHealth}`);
        
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            console.log(`☠️ Zombie died!`);
            return true; // 返回true表示死亡
        }
        
        return false; // 返回false表示存活
    }
    
    /**
     * 是否存活
     */
    isAlive() {
        return !this.isDead && this.health > 0;
    }
    
    /**
     * 移动逻辑
     */
    moveTowardsTarget(delta) {
        const currentPos = this.group.position.clone();
        const direction = new T.Vector3().subVectors(this.targetPosition, currentPos);
        const distance = direction.length();
        
        if (distance > 0.5) {
            direction.normalize();
            const angle = Math.atan2(direction.x, direction.z);
            this.group.rotation.y = angle;
            
            const moveSpeed = this.speed * delta;
            this.group.position.add(direction.multiplyScalar(moveSpeed));
        }
    }
    
    /**
     * 每帧更新
     */
    stepWorld(delta, timeOfDay) {
        if (!this.isAlive()) return;
        
        this.moveTowardsTarget(delta);
        
        // 眼睛闪烁
        const eyeIntensity = 1.0 + Math.sin(Date.now() * 0.01) * 0.5;
        if (this.leftEye && this.rightEye) {
            this.leftEye.material.emissiveIntensity = eyeIntensity;
            this.rightEye.material.emissiveIntensity = eyeIntensity;
        }
    }
}

Zombie.counter = 0;

const getPoseModelType = () => poseModelType;

export { initSharedDetector, sharedDetector, getPoseModelType };