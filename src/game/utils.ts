export class Vec2 {
    constructor(public x: number, public y: number) {}
    
    add(v: Vec2) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v: Vec2) { return new Vec2(this.x - v.x, this.y - v.y); }
    mult(n: number) { return new Vec2(this.x * n, this.y * n); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const m = this.mag();
        return m === 0 ? new Vec2(0, 0) : new Vec2(this.x / m, this.y / m);
    }
}

export function resolveCircleAABB(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number) {
    let testX = cx;
    let testY = cy;

    if (cx < rx) testX = rx;
    else if (cx > rx + rw) testX = rx + rw;

    if (cy < ry) testY = ry;
    else if (cy > ry + rh) testY = ry + rh;

    let distX = cx - testX;
    let distY = cy - testY;
    let distance = Math.sqrt((distX*distX) + (distY*distY));

    if (distance <= r) {
        let pen = r - distance;
        if (distance === 0) return { hit: true, dx: r, dy: 0 };
        return { hit: true, dx: (distX / distance) * pen, dy: (distY / distance) * pen };
    }
    return { hit: false, dx: 0, dy: 0 };
}

export function resolveCircleCircle(c1x: number, c1y: number, r1: number, c2x: number, c2y: number, r2: number) {
    let dx = c1x - c2x;
    let dy = c1y - c2y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < r1 + r2) {
        let pen = (r1 + r2) - dist;
        if (dist === 0) return { hit: true, dx: pen, dy: 0 };
        return { hit: true, dx: (dx/dist)*pen, dy: (dy/dist)*pen };
    }
    return { hit: false, dx: 0, dy: 0 };
}

export function moveTowardsAngle(current: number, target: number, maxDelta: number) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    if (Math.abs(diff) <= maxDelta) {
        return target;
    }
    return current + Math.sign(diff) * maxDelta;
}
