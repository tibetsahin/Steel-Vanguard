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
};

export type Obstacle = {
    x: number; y: number;
    w: number; h: number;
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
    type: 'repair' | 'speed';
    life: number;
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

    private nextId: number = 1;
    private player!: Tank;
    private enemies: Tank[] = [];
    private projectiles: Projectile[] = [];
    private obstacles: Obstacle[] = [];
    private particles: Particle[] = [];
    private floatingTexts: FloatingText[] = [];
    private items: Item[] = [];

    public isPaused: boolean = false;
    private playerTankType: 'light' | 'medium' | 'heavy';

    private score: number = 0;
    private spawnTimer: number = 0;
    private itemSpawnTimer: number = 5.0;

    constructor(canvas: HTMLCanvasElement, tankType: 'light' | 'medium' | 'heavy', onUpdateUI: (state: any) => void) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.playerTankType = tankType;
        this.onUpdateUI = onUpdateUI;

        this.init();
        this.setupInput();
    }

    private init() {
        let radius = 20, health = 100, speed = 200, turn = 2.5, turretTurn = 4.0, reload = 1.5, damage = 25;
        if (this.playerTankType === 'light') {
            radius = 16; health = 60; speed = 300; turn = 3.5; turretTurn = 5.0; reload = 1.0; damage = 15;
        } else if (this.playerTankType === 'heavy') {
            radius = 26; health = 200; speed = 120; turn = 1.5; turretTurn = 2.5; reload = 2.5; damage = 45;
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
            isPlayer: true,
            color: '#10b981' // emerald-500
        };

        // Generate a random city/ruins layout
        this.obstacles = [];
        for (let i = 0; i < 40; i++) {
            this.obstacles.push({
                x: Math.random() * 4000 - 2000,
                y: Math.random() * 4000 - 2000,
                w: Math.random() * 200 + 50,
                h: Math.random() * 200 + 50
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
        const handleMouseDown = (e: MouseEvent) => { if (e.button === 0) this.isMouseDown = true; };
        const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) this.isMouseDown = false; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        this.canvas.addEventListener('mousemove', handleMouseMove);
        this.canvas.addEventListener('mousedown', handleMouseDown);
        this.canvas.addEventListener('mouseup', handleMouseUp);

        // Store cleanup function
        (this as any).cleanupInput = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            this.canvas.removeEventListener('mousemove', handleMouseMove);
            this.canvas.removeEventListener('mousedown', handleMouseDown);
            this.canvas.removeEventListener('mouseup', handleMouseUp);
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

        if (this.isMouseDown && this.player.reloadTimer <= 0) {
            this.fireProjectile(this.player);
        }

        // --- Item Spawning ---
        this.itemSpawnTimer -= dt;
        if (this.itemSpawnTimer <= 0 && this.items.length < 5) {
            this.itemSpawnTimer = 15.0;
            let angle = Math.random() * Math.PI * 2;
            let dist = Math.random() * 1000 + 500;
            let type = Math.random() > 0.5 ? 'repair' : 'speed';
            this.items.push({
                id: this.nextId++,
                x: this.player.x + Math.cos(angle) * dist,
                y: this.player.y + Math.sin(angle) * dist,
                radius: 15,
                type: type as 'repair' | 'speed',
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
                }
            }
        }

        // --- Enemy Spawning ---
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.enemies.length < 10) {
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
                reloadTimer: 0, reloadTime: 2.5,
                speedBuffTimer: 0,
                damage: 20,
                isPlayer: false, color: '#ef4444' // red-500
            });
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
    }

    public forceUIUpdate() {
        this.onUpdateUI({
            health: this.player.health,
            maxHealth: this.player.maxHealth,
            reloadProgress: Math.max(0, 1 - (this.player.reloadTimer / this.player.reloadTime)),
            score: this.score,
            isPaused: this.isPaused
        });
    }

    private fireProjectile(tank: Tank) {
        tank.reloadTimer = tank.reloadTime;
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
            life: 2.0
        });

        // Muzzle flash
        this.spawnExplosion(px, py, '#f59e0b', 8);
    }

    private spawnExplosion(x: number, y: number, color: string, count: number) {
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

    private draw() {
        this.ctx.fillStyle = '#171717'; // neutral-900
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        const camX = this.player.x - this.canvas.width / 2;
        const camY = this.player.y - this.canvas.height / 2;
        this.ctx.translate(-camX, -camY);

        // Draw Grid
        const gridSize = 100;
        const offsetX = -camX % gridSize;
        const offsetY = -camY % gridSize;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let x = offsetX - gridSize; x < this.canvas.width + gridSize; x += gridSize) {
            this.ctx.moveTo(camX + x, camY); this.ctx.lineTo(camX + x, camY + this.canvas.height);
        }
        for (let y = offsetY - gridSize; y < this.canvas.height + gridSize; y += gridSize) {
            this.ctx.moveTo(camX, camY + y); this.ctx.lineTo(camX + this.canvas.width, camY + y);
        }
        this.ctx.stroke();

        // Draw Obstacles
        this.ctx.fillStyle = '#404040'; // neutral-700
        this.ctx.strokeStyle = '#262626'; // neutral-800
        this.ctx.lineWidth = 4;
        for (let obs of this.obstacles) {
            this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            this.ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
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
            }
        }

        // Draw Tanks
        const allTanks = [this.player, ...this.enemies];
        for (let tank of allTanks) {
            this.drawTank(tank);
        }

        // Draw Projectiles
        this.ctx.fillStyle = '#fde047'; // yellow-300
        for (let p of this.projectiles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
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
