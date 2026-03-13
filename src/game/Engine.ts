import { Vec2, resolveCircleAABB, resolveCircleCircle, moveTowardsAngle } from './utils';

export type Tank = {
    id: number;
    x: number; y: number;
    radius: number;
    hullAngle: number;
    turretAngle: number;
    speed: number;
    maxSpeed: number;
    turnSpeed: number;
    turretTurnSpeed: number;
    health: number;
    maxHealth: number;
    reloadTimer: number;
    reloadTime: number;
    speedBuffTimer: number;
    damage: number;
    ammo: number;
    maxAmmo: number;
    isPlayer: boolean;
    color: string;
};

export type Projectile = {
    x: number; y: number;
    vx: number; vy: number;
    radius: number;
    damage: number;
    ownerId: number;
    life: number;
    type: 'shell' | 'bullet';
};

export type Infantry = {
    id: number;
    x: number; y: number;
    radius: number;
    angle: number;
    speed: number;
    health: number;
    maxHealth: number;
    reloadTimer: number;
    reloadTime: number;
    color: string;
};

export type Obstacle = {
    x: number; y: number;
    w: number; h: number;
    type: 'building' | 'ruin' | 'wall';
};

export type Decoration = {
    x: number; y: number;
    size: number;
    type: 'crater' | 'rubble';
    rotation: number;
};

export type Particle = {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    color: string; size: number;
};

export type FloatingText = {
    x: number; y: number;
    text: string;
    life: number; maxLife: number;
    color: string;
};

export type Item = {
    id: number;
    x: number; y: number;
    radius: number;
    type: 'repair' | 'speed' | 'ammo';
    life: number;
};

export type Airplane = {
    id: number;
    x: number; y: number;
    angle: number;
    speed: number;
    bombsLeft: number;
    dropTimer: number;
    active: boolean;
};

export type Bomb = {
    x: number; y: number;
    radius: number;
    damage: number;
    life: number;
    maxLife: number;
};

export class GameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private onUpdateUI: (state: any) => void;
    private isRunning: boolean = false;
    private lastTime: number = 0;
    private animationFrameId: number = 0;

    private keys: Set<string> = new Set();
    private mouseX: number = 0;
    private mouseY: number = 0;
    private isMouseDown: boolean = false;
    private isRightMouseDown: boolean = false;

    private nextId: number = 1;
    private player!: Tank;
    private enemies: Tank[] = [];
    private infantry: Infantry[] = [];
    private projectiles: Projectile[] = [];
    private obstacles: Obstacle[] = [];
    private decorations: Decoration[] = [];
    private particles: Particle[] = [];
    private floatingTexts: FloatingText[] = [];
    private items: Item[] = [];
    private airplanes: Airplane[] = [];
    private bombs: Bomb[] = [];

    public isPaused: boolean = false;
    private playerTankType: 'light' | 'medium' | 'heavy';

    private score: number = 0;
    private spawnTimer: number = 0;
    private itemSpawnTimer: number = 5.0;
    private airplaneCooldown: number = 0;
    private airplaneMaxCooldown: number = 5.0;

    private machineGunTimer: number = 0;
    private infantrySpawnTimer: number = 3.0;

    private camera = { x: 0, y: 0, shake: 0 };

    constructor(canvas: HTMLCanvasElement, tankType: 'light' | 'medium' | 'heavy', onUpdateUI: (state: any) => void) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.playerTankType = tankType;
        this.onUpdateUI = onUpdateUI;

        this.camera.x = 0;
        this.camera.y = 0;
        this.camera.shake = 0;

        this.init();
        this.setupInput();
    }

    private init() {
        this.enemies = [];
        this.infantry = [];
        this.projectiles = [];
        this.particles = [];
        this.floatingTexts = [];
        this.items = [];
        this.airplanes = [];
        this.bombs = [];
        this.score = 0;

        let radius = 20, health = 100, speed = 200, turn = 2.5, turretTurn = 4.0, reload = 1.5, damage = 25, maxAmmo = 20;
        if (this.playerTankType === 'light') {
            radius = 16; health = 60; speed = 300; turn = 3.5; turretTurn = 5.0; reload = 1.0; damage = 15; maxAmmo = 30;
        } else if (this.playerTankType === 'heavy') {
            radius = 26; health = 400; speed = 120; turn = 1.5; turretTurn = 2.5; reload = 2.5; damage = 125; maxAmmo = 25;
        }

        this.player = {
            id: this.nextId++,
            x: 0, y: 0,
            radius: radius,
            hullAngle: -Math.PI / 2,
            turretAngle: -Math.PI / 2,
            speed: 0, maxSpeed: speed,
            turnSpeed: turn, turretTurnSpeed: turretTurn,
            health: health, maxHealth: health,
            reloadTimer: 0, reloadTime: reload,
            speedBuffTimer: 0,
            damage: damage,
            ammo: maxAmmo,
            maxAmmo: maxAmmo,
            isPlayer: true,
            color: '#10b981' // emerald-500
        };

        this.camera.x = this.player.x - this.canvas.width / 2;
        this.camera.y = this.player.y - this.canvas.height / 2;

        // Generate a war-torn city layout
        this.obstacles = [];
        this.decorations = [];
        
        // Add streets and blocks
        for (let i = 0; i < 50; i++) {
            const isHorizontal = Math.random() > 0.5;
            const x = Math.random() * 4000 - 2000;
            const y = Math.random() * 4000 - 2000;
            const w = isHorizontal ? Math.random() * 300 + 100 : Math.random() * 50 + 40;
            const h = isHorizontal ? Math.random() * 50 + 40 : Math.random() * 300 + 100;
            
            this.obstacles.push({
                x, y, w, h,
                type: Math.random() > 0.3 ? 'ruin' : 'building'
            });
        }

        // Add decorations (craters and rubble)
        for (let i = 0; i < 100; i++) {
            this.decorations.push({
                x: Math.random() * 5000 - 2500,
                y: Math.random() * 5000 - 2500,
                size: Math.random() * 40 + 10,
                type: Math.random() > 0.4 ? 'rubble' : 'crater',
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    private setupInput() {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.isPaused = !this.isPaused;
                this.forceUIUpdate();
            }
            this.keys.add(e.key.toLowerCase());
        };
        const handleKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
        const handleMouseMove = (e: MouseEvent) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        };
        const handleMouseDown = (e: MouseEvent) => { 
            if (e.button === 0) this.isMouseDown = true; 
            if (e.button === 2) this.isRightMouseDown = true;
        };
        const handleMouseUp = (e: MouseEvent) => { 
            if (e.button === 0) this.isMouseDown = false; 
            if (e.button === 2) this.isRightMouseDown = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        this.canvas.addEventListener('mousemove', handleMouseMove);
        this.canvas.addEventListener('mousedown', handleMouseDown);
        this.canvas.addEventListener('mouseup', handleMouseUp);
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Store cleanup function
        (this as any).cleanupInput = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            this.canvas.removeEventListener('mousemove', handleMouseMove);
            this.canvas.removeEventListener('mousedown', handleMouseDown);
            this.canvas.removeEventListener('mouseup', handleMouseUp);
            this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        };
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    public stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);
        if ((this as any).cleanupInput) (this as any).cleanupInput();
    }

    private loop = (time: number) => {
        if (!this.isRunning) return;
        
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (dt > 0.1) dt = 0.1; // Cap dt to prevent huge jumps

        if (!this.isPaused) {
            this.update(dt);
        }
        this.draw();

        this.animationFrameId = requestAnimationFrame(this.loop);
    };

    private update(dt: number) {
        // --- Player Input ---
        let inputY = 0;
        let inputX = 0;
        if (this.keys.has('w')) inputY += 1;
        if (this.keys.has('s')) inputY -= 1;
        if (this.keys.has('a')) inputX -= 1;
        if (this.keys.has('d')) inputX += 1;

        let currentPlayerMaxSpeed = this.player.maxSpeed * (this.player.speedBuffTimer > 0 ? 1.5 : 1.0);

        if (inputY !== 0) {
            this.player.speed = currentPlayerMaxSpeed * inputY;
        } else {
            this.player.speed *= 0.9; // Friction
        }

        if (inputX !== 0) {
            this.player.hullAngle += inputX * this.player.turnSpeed * dt;
        }

        // Mouse aiming
        const camX = this.player.x - this.canvas.width / 2;
        const camY = this.player.y - this.canvas.height / 2;
        const mouseWorldX = this.mouseX + camX;
        const mouseWorldY = this.mouseY + camY;

        const targetAngle = Math.atan2(mouseWorldY - this.player.y, mouseWorldX - this.player.x);
        this.player.turretAngle = moveTowardsAngle(this.player.turretAngle, targetAngle, this.player.turretTurnSpeed * dt);

        if (this.isMouseDown && this.player.reloadTimer <= 0 && this.player.ammo > 0) {
            this.fireProjectile(this.player);
        }

        // Machine Gun
        this.machineGunTimer -= dt;
        if (this.isRightMouseDown && this.machineGunTimer <= 0) {
            this.fireMachineGun();
        }

        if (this.keys.has('f') && this.airplaneCooldown <= 0) {
            this.callAirplane();
        }

        this.airplaneCooldown = Math.max(0, this.airplaneCooldown - dt);

        // --- Item Spawning ---
        this.itemSpawnTimer -= dt;
        if (this.itemSpawnTimer <= 0 && this.items.length < 12) {
            this.itemSpawnTimer = 5.0;
            let angle = Math.random() * Math.PI * 2;
            let dist = Math.random() * 1000 + 500;
            let rand = Math.random();
            let type: 'repair' | 'speed' | 'ammo' = 'repair';
            if (rand > 0.66) type = 'speed';
            else if (rand > 0.33) type = 'ammo';
            
            this.items.push({
                id: this.nextId++,
                x: this.player.x + Math.cos(angle) * dist,
                y: this.player.y + Math.sin(angle) * dist,
                radius: 15,
                type: type,
                life: 30.0
            });
        }

        // --- Update Items ---
        for (let i = this.items.length - 1; i >= 0; i--) {
            let item = this.items[i];
            item.life -= dt;
            if (item.life <= 0) {
                this.items.splice(i, 1);
                continue;
            }

            let res = resolveCircleCircle(this.player.x, this.player.y, this.player.radius, item.x, item.y, item.radius);
            if (res.hit) {
                if (item.type === 'repair' && this.player.health < this.player.maxHealth) {
                    let healAmount = 30;
                    this.player.health = Math.min(this.player.maxHealth, this.player.health + healAmount);
                    this.floatingTexts.push({
                        x: this.player.x, y: this.player.y - 30,
                        text: "+30 ARMOR",
                        life: 1.5, maxLife: 1.5,
                        color: "#10b981"
                    });
                    this.items.splice(i, 1);
                } else if (item.type === 'speed') {
                    this.player.speedBuffTimer = 10.0;
                    this.floatingTexts.push({
                        x: this.player.x, y: this.player.y - 30,
                        text: "SPEED BOOST",
                        life: 1.5, maxLife: 1.5,
                        color: "#3b82f6"
                    });
                    this.items.splice(i, 1);
                } else if (item.type === 'ammo' && this.player.ammo < this.player.maxAmmo) {
                    let ammoAmount = Math.ceil(this.player.maxAmmo * 0.5);
                    this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + ammoAmount);
                    this.floatingTexts.push({
                        x: this.player.x, y: this.player.y - 30,
                        text: `+${ammoAmount} AMMO`,
                        life: 1.5, maxLife: 1.5,
                        color: "#f59e0b"
                    });
                    this.items.splice(i, 1);
                }
            }
        }

        // --- Enemy Spawning ---
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.enemies.length < 6) {
            this.spawnTimer = 4.0;
            let angle = Math.random() * Math.PI * 2;
            let dist = Math.max(this.canvas.width, this.canvas.height) + 200;
            this.enemies.push({
                id: this.nextId++,
                x: this.player.x + Math.cos(angle) * dist,
                y: this.player.y + Math.sin(angle) * dist,
                radius: 20,
                hullAngle: 0, turretAngle: 0,
                speed: 0, maxSpeed: 120,
                turnSpeed: 1.5, turretTurnSpeed: 2.0,
                health: 50, maxHealth: 50,
                reloadTimer: 0, reloadTime: 3,
                speedBuffTimer: 0,
                damage: 20,
                ammo: 999, // Enemies have infinite ammo for now
                maxAmmo: 999,
                isPlayer: false, color: '#ef4444' // red-500
            });
        }

        // --- Infantry Spawning ---
        this.infantrySpawnTimer -= dt;
        if (this.infantrySpawnTimer <= 0 && this.infantry.length < 15) {
            this.infantrySpawnTimer = 2.0;
            let angle = Math.random() * Math.PI * 2;
            let dist = Math.max(this.canvas.width, this.canvas.height) + 200;
            this.infantry.push({
                id: this.nextId++,
                x: this.player.x + Math.cos(angle) * dist,
                y: this.player.y + Math.sin(angle) * dist,
                radius: 8,
                angle: 0,
                speed: 60,
                health: 15,
                maxHealth: 15,
                reloadTimer: Math.random() * 2,
                reloadTime: 2.0,
                color: '#94a3b8' // slate-400
            });
        }

        // --- Update Infantry ---
        for (let i = this.infantry.length - 1; i >= 0; i--) {
            let unit = this.infantry[i];
            unit.reloadTimer -= dt;

            let distToPlayer = Math.sqrt(Math.pow(this.player.x - unit.x, 2) + Math.pow(this.player.y - unit.y, 2));
            let targetAngle = Math.atan2(this.player.y - unit.y, this.player.x - unit.x);
            unit.angle = moveTowardsAngle(unit.angle, targetAngle, 3 * dt);

            if (distToPlayer > 300) {
                unit.x += Math.cos(unit.angle) * unit.speed * dt;
                unit.y += Math.sin(unit.angle) * unit.speed * dt;
            }

            if (unit.reloadTimer <= 0 && distToPlayer < 600) {
                this.fireInfantryBullet(unit);
            }

            // Collisions with obstacles
            for (let obs of this.obstacles) {
                let res = resolveCircleAABB(unit.x, unit.y, unit.radius, obs.x, obs.y, obs.w, obs.h);
                if (res.hit) {
                    unit.x += res.dx;
                    unit.y += res.dy;
                }
            }
        }

        // --- Update Tanks ---
        const allTanks = [this.player, ...this.enemies];
        
        allTanks.forEach(tank => {
            tank.reloadTimer -= dt;
            tank.speedBuffTimer -= dt;

            // Move
            tank.x += Math.cos(tank.hullAngle) * tank.speed * dt;
            tank.y += Math.sin(tank.hullAngle) * tank.speed * dt;

            // AI Logic
            if (!tank.isPlayer) {
                let distToPlayer = new Vec2(this.player.x - tank.x, this.player.y - tank.y).mag();
                let aiTargetAngle = Math.atan2(this.player.y - tank.y, this.player.x - tank.x);
                let currentMaxSpeed = tank.maxSpeed * (tank.speedBuffTimer > 0 ? 1.5 : 1.0);

                if (distToPlayer > 400) {
                    tank.hullAngle = moveTowardsAngle(tank.hullAngle, aiTargetAngle, tank.turnSpeed * dt);
                    tank.speed = currentMaxSpeed;
                } else if (distToPlayer < 250) {
                    tank.hullAngle = moveTowardsAngle(tank.hullAngle, aiTargetAngle, tank.turnSpeed * dt);
                    tank.speed = -currentMaxSpeed * 0.5;
                } else {
                    tank.speed *= 0.9;
                }

                tank.turretAngle = moveTowardsAngle(tank.turretAngle, aiTargetAngle, tank.turretTurnSpeed * dt);

                let aimDiff = Math.abs(tank.turretAngle - aiTargetAngle);
                while (aimDiff > Math.PI) aimDiff -= Math.PI * 2;
                aimDiff = Math.abs(aimDiff);

                if (aimDiff < 0.1 && tank.reloadTimer <= 0 && distToPlayer < 700) {
                    this.fireProjectile(tank);
                }
            }

            // Collisions with obstacles
            for (let obs of this.obstacles) {
                let res = resolveCircleAABB(tank.x, tank.y, tank.radius, obs.x, obs.y, obs.w, obs.h);
                if (res.hit) {
                    tank.x += res.dx;
                    tank.y += res.dy;
                }
            }
        });

        // Tank vs Tank collisions
        for (let i = 0; i < allTanks.length; i++) {
            for (let j = i + 1; j < allTanks.length; j++) {
                let t1 = allTanks[i];
                let t2 = allTanks[j];
                let res = resolveCircleCircle(t1.x, t1.y, t1.radius, t2.x, t2.y, t2.radius);
                if (res.hit) {
                    t1.x += res.dx * 0.5; t1.y += res.dy * 0.5;
                    t2.x -= res.dx * 0.5; t2.y -= res.dy * 0.5;
                }
            }
        }

        // --- Update Projectiles ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            let destroyed = false;
            if (p.life <= 0) destroyed = true;

            // Projectile vs Obstacle
            if (!destroyed) {
                for (let obs of this.obstacles) {
                    let res = resolveCircleAABB(p.x, p.y, p.radius, obs.x, obs.y, obs.w, obs.h);
                    if (res.hit) {
                        destroyed = true;
                        this.spawnExplosion(p.x, p.y, '#737373', 5); // Dust
                        break;
                    }
                }
            }

            // Projectile vs Tanks
            if (!destroyed) {
                for (let tank of allTanks) {
                    if (tank.id === p.ownerId) continue; // Don't hit self
                    let res = resolveCircleCircle(p.x, p.y, p.radius, tank.x, tank.y, tank.radius);
                    if (res.hit) {
                        destroyed = true;
                        
                        if (p.type === 'shell') {
                            // --- ARMOR MECHANICS (War Thunder style) ---
                            let toImpact = new Vec2(p.x - tank.x, p.y - tank.y).normalize();
                            let tankForward = new Vec2(Math.cos(tank.hullAngle), Math.sin(tank.hullAngle));
                            let dot = toImpact.x * tankForward.x + toImpact.y * tankForward.y;

                            let damageMult = 1;
                            let hitText = "";
                            let color = "#fff";

                            if (dot > 0.6) {
                                damageMult = 0.2; // Front armor bounces/resists
                                hitText = "RICOCHET";
                                color = "#a3a3a3";
                                this.spawnExplosion(p.x, p.y, '#fbbf24', 3); // sparks
                            } else if (dot < -0.6) {
                                damageMult = 2.0; // Rear armor weak
                                hitText = "CRITICAL HIT";
                                color = "#ef4444";
                                this.spawnExplosion(p.x, p.y, '#ef4444', 10);
                            } else {
                                damageMult = 1.0; // Side
                                hitText = "PENETRATION";
                                color = "#fcd34d";
                                this.spawnExplosion(p.x, p.y, '#f97316', 8);
                            }

                            tank.health -= p.damage * damageMult;
                            this.floatingTexts.push({
                                x: tank.x, y: tank.y - 30,
                                text: hitText,
                                life: 1.5, maxLife: 1.5,
                                color: color
                            });
                        } else {
                            // Machine gun bullet
                            tank.health -= p.damage;
                            this.spawnExplosion(p.x, p.y, '#f97316', 2);
                        }

                        break;
                    }
                }
            }

            // Projectile vs Infantry
            if (!destroyed) {
                for (let i = this.infantry.length - 1; i >= 0; i--) {
                    let unit = this.infantry[i];
                    if (unit.id === p.ownerId) continue;
                    let res = resolveCircleCircle(p.x, p.y, p.radius, unit.x, unit.y, unit.radius);
                    if (res.hit) {
                        destroyed = true;
                        unit.health -= p.damage;
                        this.spawnExplosion(p.x, p.y, '#ef4444', 3);
                        if (unit.health <= 0) {
                            this.spawnExplosion(unit.x, unit.y, '#ef4444', 5);
                            this.infantry.splice(i, 1);
                            this.score += 20;
                        }
                        break;
                    }
                }
            }

            if (destroyed) {
                this.projectiles.splice(i, 1);
            }
        }

        // --- Update Particles & Texts ---
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // --- Update Airplanes ---
        for (let i = this.airplanes.length - 1; i >= 0; i--) {
            let plane = this.airplanes[i];
            plane.x += Math.cos(plane.angle) * plane.speed * dt;
            plane.y += Math.sin(plane.angle) * plane.speed * dt;

            plane.dropTimer -= dt;
            if (plane.dropTimer <= 0 && plane.bombsLeft > 0) {
                plane.dropTimer = 0.5;
                plane.bombsLeft--;
                this.bombs.push({
                    x: plane.x,
                    y: plane.y,
                    radius: 10,
                    damage: 100,
                    life: 1.5,
                    maxLife: 1.5
                });
            }

            // Remove plane if it's far away
            let distToPlayer = Math.sqrt(Math.pow(plane.x - this.player.x, 2) + Math.pow(plane.y - this.player.y, 2));
            if (distToPlayer > 3000) {
                this.airplanes.splice(i, 1);
            }
        }

        // --- Update Bombs ---
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            let bomb = this.bombs[i];
            bomb.life -= dt;
            if (bomb.life <= 0) {
                // Explode!
                this.spawnExplosion(bomb.x, bomb.y, '#f97316', 40);
                this.spawnExplosion(bomb.x, bomb.y, '#ef4444', 30);
                
                // Damage nearby tanks
                const allTanks = [this.player, ...this.enemies];
                for (let tank of allTanks) {
                    let dist = Math.sqrt(Math.pow(tank.x - bomb.x, 2) + Math.pow(tank.y - bomb.y, 2));
                    if (dist < 300) {
                        let damageMult = 1 - (dist / 300);
                        tank.health -= bomb.damage * damageMult;
                        this.floatingTexts.push({
                            x: tank.x, y: tank.y - 30,
                            text: "BOMB HIT!",
                            life: 1.5, maxLife: 1.5,
                            color: "#ef4444"
                        });
                    }
                }

                this.bombs.splice(i, 1);
            }
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let ft = this.floatingTexts[i];
            ft.life -= dt;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // --- Death Logic ---
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].health <= 0) {
                this.spawnExplosion(this.enemies[i].x, this.enemies[i].y, '#ef4444', 30);
                this.enemies.splice(i, 1);
                this.score += 100;
            }
        }

        // --- UI Update ---
        this.forceUIUpdate();

        // --- Camera Update ---
        const targetCamX = this.player.x - this.canvas.width / 2;
        const targetCamY = this.player.y - this.canvas.height / 2;
        
        // Smooth follow (lerp)
        this.camera.x += (targetCamX - this.camera.x) * 5 * dt;
        this.camera.y += (targetCamY - this.camera.y) * 5 * dt;
        
        // Decay shake
        if (this.camera.shake > 0) {
            this.camera.shake -= 40 * dt;
            if (this.camera.shake < 0) this.camera.shake = 0;
        }
    }

    public forceUIUpdate() {
        this.onUpdateUI({
            health: this.player.health,
            maxHealth: this.player.maxHealth,
            reloadProgress: Math.max(0, 1 - (this.player.reloadTimer / this.player.reloadTime)),
            score: this.score,
            isPaused: this.isPaused,
            ammo: this.player.ammo,
            maxAmmo: this.player.maxAmmo
        });
    }

    private fireProjectile(tank: Tank) {
        tank.reloadTimer = tank.reloadTime;
        tank.ammo--;
        let barrelLength = tank.radius + 15;
        let px = tank.x + Math.cos(tank.turretAngle) * barrelLength;
        let py = tank.y + Math.sin(tank.turretAngle) * barrelLength;

        this.projectiles.push({
            x: px, y: py,
            vx: Math.cos(tank.turretAngle) * 1000,
            vy: Math.sin(tank.turretAngle) * 1000,
            radius: 4,
            damage: tank.damage,
            ownerId: tank.id,
            life: 2.0,
            type: 'shell'
        });

        // Muzzle flash
        this.spawnExplosion(px, py, '#f59e0b', 8);
    }

    private fireMachineGun() {
        this.machineGunTimer = 0.1; // 10 shots per second
        
        let barrelLength = this.player.radius + 10;
        // Alternate between two machine guns on the turret
        let offset = (Math.random() > 0.5 ? 1 : -1) * 8;
        
        let px = this.player.x + Math.cos(this.player.turretAngle) * barrelLength + Math.cos(this.player.turretAngle + Math.PI/2) * offset;
        let py = this.player.y + Math.sin(this.player.turretAngle) * barrelLength + Math.sin(this.player.turretAngle + Math.PI/2) * offset;

        this.projectiles.push({
            x: px, y: py,
            vx: Math.cos(this.player.turretAngle) * 1200 + (Math.random() - 0.5) * 100,
            vy: Math.sin(this.player.turretAngle) * 1200 + (Math.random() - 0.5) * 100,
            radius: 2,
            damage: 3,
            ownerId: this.player.id,
            life: 1.0,
            type: 'bullet'
        });

        // Small muzzle flash
        this.spawnExplosion(px, py, '#fcd34d', 2);
    }

    private fireInfantryBullet(unit: Infantry) {
        unit.reloadTimer = unit.reloadTime;
        
        let px = unit.x + Math.cos(unit.angle) * 12;
        let py = unit.y + Math.sin(unit.angle) * 12;

        this.projectiles.push({
            x: px, y: py,
            vx: Math.cos(unit.angle) * 600,
            vy: Math.sin(unit.angle) * 600,
            radius: 2,
            damage: 5,
            ownerId: unit.id,
            life: 1.5,
            type: 'bullet'
        });
    }

    private spawnExplosion(x: number, y: number, color: string, count: number) {
        // Add screen shake based on explosion size
        this.camera.shake = Math.min(this.camera.shake + count * 0.4, 25);

        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 100 + 50;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.random() * 0.3 + 0.1,
                maxLife: 0.4,
                color: color,
                size: Math.random() * 6 + 2
            });
        }
    }

    private callAirplane() {
        this.airplaneCooldown = this.airplaneMaxCooldown;
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 1500;
        const startX = this.player.x + Math.cos(angle) * dist;
        const startY = this.player.y + Math.sin(angle) * dist;
        
        const flyAngle = Math.atan2(this.player.y - startY, this.player.x - startX);
        
        this.airplanes.push({
            id: this.nextId++,
            x: startX,
            y: startY,
            angle: flyAngle,
            speed: 500,
            bombsLeft: 8,
            dropTimer: 1.0,
            active: true
        });

        this.floatingTexts.push({
            x: this.player.x, y: this.player.y - 60,
            text: "AIR SUPPORT INBOUND! (F)",
            life: 2.0, maxLife: 2.0,
            color: "#3b82f6"
        });
    }

    private draw() {
        // Background - Cracked asphalt / concrete color
        this.ctx.fillStyle = '#262626'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        
        // Apply camera with shake
        let shakeX = (Math.random() - 0.5) * this.camera.shake;
        let shakeY = (Math.random() - 0.5) * this.camera.shake;
        
        this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

        // Draw Ground Details (Decorations)
        for (let dec of this.decorations) {
            this.ctx.save();
            this.ctx.translate(dec.x, dec.y);
            this.ctx.rotate(dec.rotation);
            
            if (dec.type === 'crater') {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, dec.size, dec.size * 0.7, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                this.ctx.stroke();
            } else {
                // Rubble
                this.ctx.fillStyle = '#404040';
                for(let j=0; j<3; j++) {
                    this.ctx.fillRect(Math.random()*dec.size - dec.size/2, Math.random()*dec.size - dec.size/2, 5, 5);
                }
            }
            this.ctx.restore();
        }

        // Draw Grid (Subtle pavement lines)
        const gridSize = 200;
        const offsetX = -this.camera.x % gridSize;
        const offsetY = -this.camera.y % gridSize;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = offsetX - gridSize; x < this.canvas.width + gridSize; x += gridSize) {
            this.ctx.moveTo(this.camera.x + x, this.camera.y); this.ctx.lineTo(this.camera.x + x, this.camera.y + this.canvas.height);
        }
        for (let y = offsetY - gridSize; y < this.canvas.height + gridSize; y += gridSize) {
            this.ctx.moveTo(this.camera.x, this.camera.y + y); this.ctx.lineTo(this.camera.x + this.canvas.width, this.camera.y + y);
        }
        this.ctx.stroke();

        // Draw Obstacles (Ruined Buildings)
        for (let obs of this.obstacles) {
            this.drawRuin(obs);
        }

        // Draw Items
        for (let item of this.items) {
            if (item.type === 'repair') {
                this.ctx.fillStyle = '#10b981'; // emerald-500
                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw plus sign
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(item.x - 2, item.y - 8, 4, 16);
                this.ctx.fillRect(item.x - 8, item.y - 2, 16, 4);
            } else if (item.type === 'speed') {
                this.ctx.fillStyle = '#3b82f6'; // blue-500
                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw forward arrows (>>)
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.moveTo(item.x - 4, item.y - 6);
                this.ctx.lineTo(item.x + 4, item.y);
                this.ctx.lineTo(item.x - 4, item.y + 6);
                this.ctx.lineTo(item.x - 2, item.y);
                this.ctx.fill();
            } else if (item.type === 'ammo') {
                this.ctx.fillStyle = '#f59e0b'; // amber-500
                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw bullet icon (simple rectangle)
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(item.x - 3, item.y - 6, 6, 12);
                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y - 6, 3, 0, Math.PI, true);
                this.ctx.fill();
            }
        }

        // Draw Tanks
        const allTanks = [this.player, ...this.enemies];
        for (let tank of allTanks) {
            this.drawTank(tank);
        }

        // Draw Infantry
        for (let unit of this.infantry) {
            this.ctx.save();
            this.ctx.translate(unit.x, unit.y);
            this.ctx.rotate(unit.angle);
            
            // Body
            this.ctx.fillStyle = unit.color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, unit.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Gun
            this.ctx.fillStyle = '#334155';
            this.ctx.fillRect(0, -2, 12, 4);
            
            this.ctx.restore();
            
            // Health bar
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(unit.x - 10, unit.y - 15, 20, 3);
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(unit.x - 10, unit.y - 15, 20 * (unit.health / unit.maxHealth), 3);
        }

        // Draw Projectiles
        this.ctx.fillStyle = '#fde047'; // yellow-300
        for (let p of this.projectiles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw Bombs
        for (let bomb of this.bombs) {
            this.ctx.save();
            // Shadow
            this.ctx.globalAlpha = 0.2;
            this.ctx.fillStyle = '#ef4444'; // Reddish shadow for danger
            this.ctx.beginPath();
            this.ctx.arc(bomb.x, bomb.y, 100 * (bomb.life / bomb.maxLife), 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bomb body
            this.ctx.globalAlpha = 1.0;
            this.ctx.fillStyle = '#404040';
            this.ctx.beginPath();
            this.ctx.arc(bomb.x, bomb.y, 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        // Draw Airplanes
        for (let plane of this.airplanes) {
            this.ctx.save();
            this.ctx.translate(plane.x, plane.y);
            this.ctx.rotate(plane.angle);
            
            // Simple plane shape
            this.ctx.fillStyle = '#525252';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            // Body
            this.ctx.fillRect(-25, -6, 50, 12);
            // Wings
            this.ctx.fillRect(-5, -40, 12, 80);
            // Tail
            this.ctx.fillRect(-25, -15, 6, 30);
            
            this.ctx.restore();
        }

        // Draw Particles
        for (let p of this.particles) {
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;

        // Draw Floating Texts
        this.ctx.font = 'bold 14px "Inter", sans-serif';
        this.ctx.textAlign = 'center';
        for (let ft of this.floatingTexts) {
            this.ctx.globalAlpha = ft.life / ft.maxLife;
            this.ctx.fillStyle = ft.color;
            this.ctx.fillText(ft.text, ft.x, ft.y - (1 - ft.life/ft.maxLife) * 30);
        }
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }

    private drawRuin(obs: Obstacle) {
        this.ctx.save();
        
        // Base structure
        this.ctx.fillStyle = '#525252'; // Concrete gray
        this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        
        // Ruin details (broken walls/windows)
        this.ctx.strokeStyle = '#171717';
        this.ctx.lineWidth = 2;
        
        // Draw some "rooms" or internal walls
        this.ctx.beginPath();
        if (obs.w > obs.h) {
            for(let x = obs.x + 40; x < obs.x + obs.w; x += 60) {
                this.ctx.moveTo(x, obs.y);
                this.ctx.lineTo(x, obs.y + obs.h * 0.7);
            }
        } else {
            for(let y = obs.y + 40; y < obs.y + obs.h; y += 60) {
                this.ctx.moveTo(obs.x, y);
                this.ctx.lineTo(obs.x + obs.w * 0.7, y);
            }
        }
        this.ctx.stroke();

        // Broken edges (jagged look)
        this.ctx.fillStyle = '#262626';
        const seed = (obs.x + obs.y) % 100;
        if (seed > 50) {
            // Top jagged
            this.ctx.beginPath();
            this.ctx.moveTo(obs.x, obs.y);
            this.ctx.lineTo(obs.x + obs.w * 0.3, obs.y + 10);
            this.ctx.lineTo(obs.x + obs.w * 0.6, obs.y - 5);
            this.ctx.lineTo(obs.x + obs.w, obs.y + 15);
            this.ctx.lineTo(obs.x + obs.w, obs.y);
            this.ctx.fill();
        }

        // Rebar / Exposed metal
        this.ctx.strokeStyle = '#737373';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(obs.x + obs.w, obs.y + 20);
        this.ctx.lineTo(obs.x + obs.w + 10, obs.y + 15);
        this.ctx.moveTo(obs.x + obs.w, obs.y + 30);
        this.ctx.lineTo(obs.x + obs.w + 12, obs.y + 35);
        this.ctx.stroke();

        this.ctx.restore();
    }

    private drawTank(tank: Tank) {
        this.ctx.save();
        this.ctx.translate(tank.x, tank.y);

        // Draw hull
        this.ctx.save();
        this.ctx.rotate(tank.hullAngle);
        
        // Treads
        this.ctx.fillStyle = '#171717'; // neutral-900
        this.ctx.fillRect(-tank.radius*1.1, -tank.radius, tank.radius*2.2, tank.radius*0.4);
        this.ctx.fillRect(-tank.radius*1.1, tank.radius*0.6, tank.radius*2.2, tank.radius*0.4);
        
        // Main body
        this.ctx.fillStyle = tank.color;
        this.ctx.fillRect(-tank.radius, -tank.radius*0.8, tank.radius*2, tank.radius*1.6);
        
        // Front indicator (white stripe)
        this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
        this.ctx.fillRect(tank.radius*0.6, -tank.radius*0.2, tank.radius*0.4, tank.radius*0.4);
        this.ctx.restore();

        // Draw turret
        this.ctx.save();
        this.ctx.rotate(tank.turretAngle);
        
        // Barrel
        this.ctx.fillStyle = '#525252'; // neutral-600
        this.ctx.fillRect(0, -4, tank.radius + 20, 8);
        
        // Turret body
        this.ctx.fillStyle = '#404040'; // neutral-700
        this.ctx.beginPath();
        this.ctx.arc(0, 0, tank.radius * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#262626';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.restore();

        // Health bar (only for enemies)
        if (!tank.isPlayer) {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(-15, -tank.radius - 15, 30, 4);
            this.ctx.fillStyle = '#10b981';
            this.ctx.fillRect(-15, -tank.radius - 15, 30 * (tank.health / tank.maxHealth), 4);
        }

        this.ctx.restore();
    }
}
