import { LayoutItem, PatternConfig, ProcessedAsset } from '../types';

export class PatternEngine {
  private ctx: CanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;
  private assets: Map<string, ProcessedAsset> = new Map();
  private maskData: Uint8ClampedArray | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;

  constructor() {}

  public setContext(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  public setAssets(assets: ProcessedAsset[]) {
    this.assets.clear();
    assets.forEach(a => this.assets.set(a.id, a));
  }

  public setMask(img: HTMLImageElement | null) {
    if (!img) {
      this.maskData = null;
      this.maskCanvas = null;
      return;
    }

    // Create an offscreen canvas for the mask to read pixel data
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw 'contain' style
    const imgRatio = img.width / img.height;
    const screenRatio = this.width / this.height;
    let drawW, drawH, drawX, drawY;

    if (screenRatio > imgRatio) {
      drawH = this.height * 0.9;
      drawW = drawH * imgRatio;
    } else {
      drawW = this.width * 0.9;
      drawH = drawW / imgRatio;
    }
    drawX = (this.width - drawW) / 2;
    drawY = (this.height - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    this.maskData = ctx.getImageData(0, 0, this.width, this.height).data;
    this.maskCanvas = canvas;
  }

  // --- Optimization: Pre-tint icons to avoid globalCompositeOperation per frame ---
  private createTintedCanvas(asset: ProcessedAsset, color: string, width: number, height: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    ctx.drawImage(asset.img, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return c;
  }

  public generateLayout(config: PatternConfig): LayoutItem[] {
    const items: LayoutItem[] = [];
    if (this.assets.size === 0) return items;

    const assetList = Array.from(this.assets.values());

    if (config.mode === 'grid') {
        // --- Grid Mode ---
        const iconSize = config.maxSize;
        const step = iconSize + config.gridGap;
        if (step <= 0) return items;

        const cols = Math.ceil(this.width / step) + 1;
        const rows = Math.ceil(this.height / step) + 1;
        const startX = (this.width - cols * step) / 2 + step / 2;
        const startY = (this.height - rows * step) / 2 + step / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = startX + c * step;
                const y = startY + r * step;

                // Mask Check
                if (config.useMask && this.maskData) {
                    if (!this.checkMask(x, y)) continue;
                }

                const asset = assetList[Math.floor(Math.random() * assetList.length)];
                this.addItem(items, asset, x, y, iconSize, config);
            }
        }

    } else {
        // --- Random Mode ---
        let count = 0;
        let attempts = 0;
        const maxAttempts = config.density * 50; // Safety break
        
        while (count < config.density && attempts < maxAttempts) {
            attempts++;
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            
            // Mask Check
            if (config.useMask && this.maskData) {
                 if (!this.checkMask(x, y)) continue;
            }

            const size = Math.random() * (config.maxSize - config.minSize) + config.minSize;
            const asset = assetList[Math.floor(Math.random() * assetList.length)];
            
            // Calculate dimensions based on aspect ratio
            let w = size;
            let h = size / asset.aspectRatio;

            // Simple Collision Detection
            if (config.preventOverlap) {
                const r = Math.max(w, h) / 2 * 0.8; // Approximate radius
                let overlaps = false;
                for (const item of items) {
                     const dist = Math.sqrt(Math.pow(x - item.x, 2) + Math.pow(y - item.y, 2));
                     const itemR = Math.max(item.w, item.h) / 2 * 0.8;
                     if (dist < (r + itemR)) {
                         overlaps = true;
                         break;
                     }
                }
                if (overlaps) continue;
            }

            this.addItem(items, asset, x, y, w, h, config, true); // true for passing w/h directly
            count++;
        }
    }

    return items;
  }

  private addItem(
    items: LayoutItem[], 
    asset: ProcessedAsset, 
    x: number, 
    y: number, 
    sizeOrW: number,
    hOrConfig: number | PatternConfig, 
    config?: PatternConfig,
    isDirectDim = false
  ) {
    let w, h;
    let actualConfig: PatternConfig;

    if (isDirectDim) {
        w = sizeOrW;
        h = hOrConfig as number;
        actualConfig = config!;
    } else {
        actualConfig = hOrConfig as PatternConfig;
        w = sizeOrW;
        h = sizeOrW / asset.aspectRatio;
    }

    let angle = 0;

    if (actualConfig.rotationRandomness) {
        if (actualConfig.mode === 'grid') {
            // Strict orthogonal rotation for grid: 0, 90, 180, 270
            angle = (Math.floor(Math.random() * 4) * 90) * (Math.PI / 180);
        } else {
            // Free rotation for random mode
            angle = Math.random() * Math.PI * 2;
        }
    } else {
        angle = 0;
    }

    const color = (actualConfig.useRandomColor && actualConfig.colors.length > 0)
        ? actualConfig.colors[Math.floor(Math.random() * actualConfig.colors.length)]
        : null;

    // Optimization: Cache the tinted canvas if we have a color
    let cachedCanvas = null;
    if (color) {
        // We use a reasonably sized canvas for the cache to balance memory vs quality
        cachedCanvas = this.createTintedCanvas(asset, color, w, h);
    }

    items.push({
        id: Math.random().toString(36).substr(2, 9),
        assetId: asset.id,
        x, y, w, h, angle,
        color,
        cachedCanvas,
        animPhase: Math.random() * Math.PI * 2,
        animSpeedMul: 0.8 + Math.random() * 0.4
    });
  }

  private checkMask(x: number, y: number): boolean {
      if (!this.maskData) return true;
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || px >= this.width || py < 0 || py >= this.height) return false;
      
      const idx = (py * this.width + px) * 4;
      const brightness = (this.maskData[idx] + this.maskData[idx+1] + this.maskData[idx+2]) / 3;
      const alpha = this.maskData[idx+3];
      
      // Assume dark pixels or opaque pixels are the mask "area"
      return alpha > 50 && brightness < 200; 
  }

  public render(items: LayoutItem[], config: PatternConfig, time: number) {
      if (!this.ctx) return;
      
      // Clear
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Draw Mask Background
      if (config.useMask && config.showMaskBg && this.maskCanvas) {
          this.ctx.save();
          this.ctx.globalAlpha = 0.1;
          this.ctx.drawImage(this.maskCanvas, 0, 0);
          this.ctx.restore();
      }

      const amp = config.animAmplitude;
      const speed = config.animSpeed * 0.002;

      for (const item of items) {
          let dx = 0, dy = 0, dRot = 0;

          if (config.enableAnim) {
              dy = Math.sin(time * speed * item.animSpeedMul + item.animPhase) * amp;
              dx = Math.cos(time * speed * item.animSpeedMul * 0.7 + item.animPhase) * (amp * 0.5);
              dRot = Math.sin(time * speed * item.animSpeedMul * 0.5) * 0.05;
          }

          this.ctx.save();
          this.ctx.translate(item.x + dx, item.y + dy);
          this.ctx.rotate(item.angle + dRot);

          // Render Logic
          if (item.cachedCanvas) {
              // High performance path
              this.ctx.drawImage(item.cachedCanvas, -item.w/2, -item.h/2);
          } else {
              // Standard path
              const asset = this.assets.get(item.assetId);
              if (asset) {
                  this.ctx.drawImage(asset.img, -item.w/2, -item.h/2, item.w, item.h);
              }
          }

          this.ctx.restore();
      }
  }

  public exportSVG(items: LayoutItem[]): string {
      let content = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
      
      items.forEach(item => {
          const asset = this.assets.get(item.assetId);
          if (!asset) return;

          const deg = item.angle * (180 / Math.PI);
          const colorAttr = item.color ? `fill="${item.color}"` : '';
          
          if (asset.type === 'svg' && asset.vectorContent) {
               content += `
                <g transform="translate(${item.x}, ${item.y}) rotate(${deg})">
                    <svg x="${-item.w/2}" y="${-item.h/2}" width="${item.w}" height="${item.h}" viewBox="${asset.viewBox}" ${colorAttr} style="overflow: visible;">
                        ${asset.vectorContent}
                    </svg>
                </g>`;
          } else {
              content += `
                <g transform="translate(${item.x}, ${item.y}) rotate(${deg})">
                    <image href="${asset.img.src}" x="${-item.w/2}" y="${-item.h/2}" width="${item.w}" height="${item.h}" />
                </g>`;
          }
      });
      content += '</svg>';
      return content;
  }
}