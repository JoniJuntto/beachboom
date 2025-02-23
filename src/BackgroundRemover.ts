export class BackgroundRemover {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private processingCanvas: HTMLCanvasElement;
  private processingCtx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    // Main canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;

    // Processing canvas
    this.processingCanvas = document.createElement("canvas");
    this.processingCanvas.width = width;
    this.processingCanvas.height = height;
    this.processingCtx = this.processingCanvas.getContext("2d")!;
  }

  public processFrame(videoElement: HTMLVideoElement): HTMLCanvasElement {
    // Draw the current frame
    this.processingCtx.drawImage(videoElement, 0, 0);
    const frame = this.processingCtx.getImageData(
      0,
      0,
      this.processingCanvas.width,
      this.processingCanvas.height
    );

    // Process the frame
    this.removeBackground(frame);

    // Draw the processed frame
    this.ctx.putImageData(frame, 0, 0);

    return this.canvas;
  }

  private removeBackground(imageData: ImageData): void {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate luminance
      const luminance = (r + g + b) / 3;

      // Adjust these values based on your background
      const threshold = 128; // Middle gray
      const tolerance = 50; // Tolerance range

      // If the pixel is close to the background color, make it transparent
      if (
        luminance > threshold - tolerance &&
        luminance < threshold + tolerance
      ) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }
  }
}
