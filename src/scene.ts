import * as THREE from "three";

export class SoccerScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private goalPost: THREE.Group;
  private colliderBoxes: { [key: string]: THREE.Mesh } = {};

  constructor(container: HTMLElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;
    this.camera.position.y = 2;
    this.camera.lookAt(0, 1, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLighting();

    // Ground
    this.createGround();

    // Goal Post
    this.goalPost = this.createGoalPost();
    this.scene.add(this.goalPost);

    // Handle window resize
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3c8f40, // Green grass color
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private createGoalPost(): THREE.Group {
    const goal = new THREE.Group();

    // Goal dimensions
    const width = 3;
    const height = 2;
    const depth = 1;
    const poleRadius = 0.05;

    // Create poles (white material)
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    // Vertical poles
    const poleGeometry = new THREE.CylinderGeometry(
      poleRadius,
      poleRadius,
      height
    );
    const leftPole = new THREE.Mesh(poleGeometry, poleMaterial);
    const rightPole = new THREE.Mesh(poleGeometry, poleMaterial);

    leftPole.position.set(-width / 2, height / 2, 0);
    rightPole.position.set(width / 2, height / 2, 0);

    // Crossbar
    const crossbarGeometry = new THREE.CylinderGeometry(
      poleRadius,
      poleRadius,
      width
    );
    const crossbar = new THREE.Mesh(crossbarGeometry, poleMaterial);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, height, 0);

    goal.add(leftPole, rightPole, crossbar);
    return goal;
  }

  public updateColliderBoxes(bodyBoxes: any): void {
    const colors = {
      head: 0xffff00,
      leftHand: 0x0000ff,
      rightHand: 0x00ff00,
      leftLeg: 0x800080,
      rightLeg: 0xffa500,
      torso: 0xff0000,
    };

    Object.entries(bodyBoxes).forEach(([part, box]: [string, any]) => {
      if (!this.colliderBoxes[part]) {
        // Create new box if it doesn't exist
        const geometry = new THREE.BoxGeometry(1, 1, 0.2);
        const material = new THREE.MeshBasicMaterial({
          color: colors[part as keyof typeof colors],
          transparent: true,
          opacity: 0.5,
        });
        this.colliderBoxes[part] = new THREE.Mesh(geometry, material);
        this.scene.add(this.colliderBoxes[part]);
      }

      // Update box position and scale
      const width = box.maxX - box.minX;
      const height = box.maxY - box.minY;
      const centerX = (box.maxX + box.minX) / 2;
      const centerY = (box.maxY + box.minY) / 2;

      this.colliderBoxes[part].scale.set(width * 3, height * 3, 0.2);
      this.colliderBoxes[part].position.set(centerX * 3, centerY * 3, 0);
    });
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
