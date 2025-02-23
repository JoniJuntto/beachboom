import * as RAPIER from "@dimforge/rapier3d";
import * as THREE from "three";

export class SoccerScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private goalPost: THREE.Group;
  private colliderBoxes: { [key: string]: THREE.Mesh } = {};
  private rapierWorld: RAPIER.World;
  private balls: { mesh: THREE.Mesh; rigidBody: RAPIER.RigidBody }[] = [];

  constructor(container: HTMLElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1, // near
      1000 // far
    );

    // Move camera even closer
    this.camera.position.set(0, 3, 10);
    this.camera.lookAt(0, 2, 0);

    // Debug helpers
    const axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);

    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    // Add a cube as reference point
    const referenceGeometry = new THREE.BoxGeometry(1, 1, 1);
    const referenceMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const referenceCube = new THREE.Mesh(referenceGeometry, referenceMaterial);
    referenceCube.position.set(0, 1, 0);
    this.scene.add(referenceCube);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Setup rest of the scene
    this.setupLighting();
    this.createGround();
    this.goalPost = this.createGoalPost();
    this.scene.add(this.goalPost);

    // Physics world
    this.rapierWorld = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10, 0.1, 10);
    this.rapierWorld.createCollider(groundColliderDesc);

    // Debug logs
    console.log("Camera position:", this.camera.position);
    console.log(
      "Camera looking at:",
      this.camera.getWorldDirection(new THREE.Vector3())
    );
    console.log("Scene children count:", this.scene.children.length);

    window.addEventListener("resize", this.onWindowResize.bind(this));

    // Spawn balls less frequently for testing
    setInterval(() => this.spawnBall(), 5000);
  }

  private spawnBall(): void {
    const ballRadius = 0.5; // Even bigger balls
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      shininess: 100,
    });
    const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);

    // Spawn balls closer to camera
    const x = 0; // Fixed position for testing
    const y = 2; // Lower height
    const z = 4; // Closer to camera

    ballMesh.position.set(x, y, z);
    ballMesh.castShadow = true;
    this.scene.add(ballMesh);

    console.log("Adding ball to scene at:", x, y, z);
    console.log("Ball in scene:", this.scene.children.includes(ballMesh));
    console.log("Ball visible:", ballMesh.visible);
    console.log("Ball material:", ballMesh.material);

    // Create Rapier rigid body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
    const rigidBody = this.rapierWorld.createRigidBody(rigidBodyDesc);
    rigidBody.setTranslation(new RAPIER.Vector3(x, y, z), true);
    rigidBody.setLinearDamping(0.5);
    rigidBody.setAngularDamping(0.5);

    // Create ball collider
    const colliderDesc = RAPIER.ColliderDesc.ball(ballRadius)
      .setRestitution(0.7)
      .setFriction(0.3);
    this.rapierWorld.createCollider(colliderDesc, rigidBody);

    // Simplified initial velocity (just drop straight down)
    rigidBody.setLinvel(new RAPIER.Vector3(0, -1, 0), true);

    this.balls.push({ mesh: ballMesh, rigidBody: rigidBody });
    this.cleanupBalls();
  }

  private cleanupBalls(): void {
    const maxBalls = 10; // Maximum number of balls to keep in the scene
    const removalDistance = 10; // Distance from origin at which to remove balls

    this.balls = this.balls.filter((ball) => {
      const position = ball.mesh.position;
      const distanceFromOrigin = Math.sqrt(
        position.x ** 2 + position.y ** 2 + position.z ** 2
      );

      if (distanceFromOrigin > removalDistance) {
        this.scene.remove(ball.mesh);
        this.rapierWorld.removeRigidBody(ball.rigidBody);
        return false;
      }
      return true;
    });

    // Remove oldest balls if we have too many
    while (this.balls.length > maxBalls) {
      const oldestBall = this.balls.shift();
      if (oldestBall) {
        this.scene.remove(oldestBall.mesh);
        this.rapierWorld.removeRigidBody(oldestBall.rigidBody);
      }
    }
  }

  private setupLighting(): void {
    // Brighter ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);

    // Brighter directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Add point light near spawn point
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 5, 5);
    this.scene.add(pointLight);
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

    leftPole.position.set(-width / 2, height / 2, -5);
    rightPole.position.set(width / 2, height / 2, -5);

    // Crossbar
    const crossbarGeometry = new THREE.CylinderGeometry(
      poleRadius,
      poleRadius,
      width
    );
    const crossbar = new THREE.Mesh(crossbarGeometry, poleMaterial);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, height, -5);

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
    // Step the physics world with a fixed timestep
    this.rapierWorld.step();

    // Update ball positions
    this.balls.forEach((ball) => {
      const position = ball.rigidBody.translation();
      ball.mesh.position.copy(
        new THREE.Vector3(position.x, position.y, position.z)
      );

      const rotation = ball.rigidBody.rotation();
      ball.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.render());
  }
}
