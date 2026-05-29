(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};
    const C = ns.Config;

    class PlayerEngine {
        constructor(camera, controls, world, collision, ui) {
            this.camera = camera;
            this.controls = controls;
            this.world = world;
            this.collision = collision;
            this.ui = ui;
            this.velocity = new THREE.Vector3();
            this.direction = new THREE.Vector3();
            this.previous = new THREE.Vector3();
            this.tmpDir = new THREE.Vector3();
            this.keyState = { forward: false, backward: false, left: false, right: false };
            this.fallbackActive = false;
            this.isGrounded = false;
            this.isRunning = false;
            this.stamina = 100;
            this.promptTarget = null;
            this.seaToastCooldown = 0;
            this.state = {
                gold: C.devGold,
                hasBoat: false,
                onBoat: false
            };

            this.setupInput();
            this.ui.setGold(this.state.gold);
            this.ui.setBoatStatus("미보유");
        }

        setupInput() {
            document.addEventListener("keydown", (event) => {
                if (event.repeat) return;
                switch (event.code) {
                    case "KeyW":
                        this.keyState.forward = true;
                        break;
                    case "KeyA":
                        this.keyState.left = true;
                        break;
                    case "KeyS":
                        this.keyState.backward = true;
                        break;
                    case "KeyD":
                        this.keyState.right = true;
                        break;
                    case "ShiftLeft":
                    case "ShiftRight":
                        this.isRunning = true;
                        break;
                    case "Space":
                        this.jump();
                        break;
                    case "KeyE":
                        this.interact();
                        break;
                    case "Escape":
                        this.ui.hideDialog();
                        break;
                }
            });

            document.addEventListener("keyup", (event) => {
                switch (event.code) {
                    case "KeyW":
                        this.keyState.forward = false;
                        break;
                    case "KeyA":
                        this.keyState.left = false;
                        break;
                    case "KeyS":
                        this.keyState.backward = false;
                        break;
                    case "KeyD":
                        this.keyState.right = false;
                        break;
                    case "ShiftLeft":
                    case "ShiftRight":
                        this.isRunning = false;
                        break;
                }
            });
        }

        setFallbackActive(active) {
            this.fallbackActive = active;
        }

        isActive() {
            return this.controls.isLocked || this.fallbackActive;
        }

        placeAt(x, z) {
            const y = this.world.heightAt(x, z) + C.eyeHeight;
            this.camera.position.set(x, y, z);
        }

        jump() {
            if (this.state.onBoat) return;
            if (!this.isActive() && !this.ui.dialogVisible) return;
            if (this.isGrounded) {
                this.velocity.y = C.jumpForce;
                this.isGrounded = false;
            }
        }

        interact() {
            if (this.ui.dialogVisible) {
                this.ui.hideDialog();
                return;
            }

            const pos = this.camera.position;
            const target = this.collision.nearestInteraction(pos, () => !this.state.onBoat || true);
            if (target) {
                const result = this.world.handleInteraction(target, this.state, this.ui);
                this.applyInteractionResult(result);
                return;
            }

            if (this.state.onBoat && this.world.isSea(pos.x, pos.z)) {
                this.world.showSeaDialog(this.ui);
            }
        }

        applyInteractionResult(result) {
            if (!result || !result.moveTo) return;
            const x = result.moveTo.x;
            const z = result.moveTo.z;
            if (result.mode === "boat") {
                this.camera.position.set(x, C.waterLevel + C.boatEyeHeight, z);
                this.velocity.set(0, 0, 0);
            } else {
                this.camera.position.set(x, this.world.heightAt(x, z) + C.eyeHeight, z);
                this.velocity.set(0, 0, 0);
            }
        }

        update(dt) {
            this.seaToastCooldown = Math.max(0, this.seaToastCooldown - dt);

            if (this.isActive() && !this.ui.dialogVisible) {
                this.updateMovementInput(dt);
            }

            this.velocity.x -= this.velocity.x * 10 * dt;
            this.velocity.z -= this.velocity.z * 10 * dt;
            if (!this.state.onBoat) {
                this.velocity.y -= C.gravity * dt;
            }

            this.previous.copy(this.camera.position);
            this.controls.moveRight(-this.velocity.x * dt);
            this.controls.moveForward(-this.velocity.z * dt);

            const pos = this.camera.position;
            this.collision.clampToBounds(pos);

            if (this.state.onBoat) {
                this.resolveBoatMovement(pos);
            } else {
                this.resolveLandMovement(pos, dt);
            }

            this.updateHud(dt);
        }

        updateMovementInput(dt) {
            const moving = this.keyState.forward || this.keyState.backward || this.keyState.left || this.keyState.right;
            const canRun = this.isRunning && moving && !this.state.onBoat;
            let speed = this.state.onBoat ? C.boatSpeed : (canRun ? C.runSpeed : C.speed);

            if (canRun) {
                this.stamina = Math.max(0, this.stamina - C.staminaDrain * dt);
                if (this.stamina <= 0) {
                    this.isRunning = false;
                    speed = C.speed;
                }
            } else {
                this.stamina = Math.min(100, this.stamina + C.staminaRegen * dt);
            }

            this.direction.z = Number(this.keyState.forward) - Number(this.keyState.backward);
            this.direction.x = Number(this.keyState.right) - Number(this.keyState.left);
            this.direction.normalize();

            if (this.keyState.forward || this.keyState.backward) {
                this.velocity.z -= this.direction.z * speed * 10 * dt;
            }
            if (this.keyState.left || this.keyState.right) {
                this.velocity.x -= this.direction.x * speed * 10 * dt;
            }
        }

        resolveLandMovement(pos, dt) {
            if (this.world.isSea(pos.x, pos.z)) {
                pos.x = this.previous.x;
                pos.z = this.previous.z;
                this.velocity.x = 0;
                this.velocity.z = 0;
                if (this.seaToastCooldown <= 0) {
                    this.ui.showToast("맨몸으로는 바다에 들어갈 수 없습니다. 항구의 작은 돛단배가 필요합니다.");
                    this.seaToastCooldown = 1.5;
                }
            }

            this.collision.resolveObstacles(pos, C.playerRadius);
            this.collision.clampToBounds(pos);

            const ground = this.world.heightAt(pos.x, pos.z);
            if (pos.y < ground + C.eyeHeight) {
                pos.y = ground + C.eyeHeight;
                this.velocity.y = Math.max(0, this.velocity.y);
                this.isGrounded = true;
            } else {
                this.isGrounded = false;
                pos.y += this.velocity.y * dt;
            }

            if (pos.y < -30) {
                this.placeAt(-166, -96);
                this.velocity.set(0, 0, 0);
            }
        }

        resolveBoatMovement(pos) {
            if (!this.world.isBoatAllowed(pos.x, pos.z)) {
                pos.x = this.previous.x;
                pos.z = this.previous.z;
                this.velocity.x = 0;
                this.velocity.z = 0;
                if (this.seaToastCooldown <= 0) {
                    this.ui.showToast("돛단배는 항구 수면과 바다에서만 움직입니다.");
                    this.seaToastCooldown = 1.3;
                }
            }

            this.collision.resolveObstacles(pos, C.playerRadius + 1.2);
            this.collision.clampToBounds(pos);
            pos.y = C.waterLevel + C.boatEyeHeight;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        updateHud() {
            const pos = this.camera.position;
            this.ui.setPosition(pos.x, pos.z);
            this.ui.setStamina(this.stamina);
            this.ui.setBoatStatus(this.state.onBoat ? "승선 중" : (this.state.hasBoat ? "보유" : "미보유"));
            this.ui.setLocation(this.world.getLocation(pos.x, pos.z, this.state));

            this.camera.getWorldDirection(this.tmpDir);
            this.ui.setDirection(Math.atan2(this.tmpDir.x, this.tmpDir.z));

            const target = this.collision.nearestInteraction(pos);
            if (target && !this.ui.dialogVisible) {
                this.promptTarget = target;
                this.ui.showInteraction(target.label);
            } else if (this.state.onBoat && this.world.isSea(pos.x, pos.z) && !this.ui.dialogVisible) {
                this.promptTarget = null;
                this.ui.showInteraction("바다 메뉴");
            } else {
                this.promptTarget = null;
                this.ui.hideInteraction();
            }
        }
    }

    ns.PlayerEngine = PlayerEngine;
})();
