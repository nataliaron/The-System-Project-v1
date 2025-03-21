let video;
let poseNet;
let poses = [];
let particles = [];
let mode = 1; // Tryby: 0 = Wideo + efekty, 1 = Czarne tło + efekty, 2 = Siatka
let mic, amp;
let pulseFactor = 0; 
let micActive = false;
let bgMusic;

function preload() {
    bgMusic = loadSound("background_music.mp3"); // Załaduj plik muzyczny
}

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');
    video = createCapture(VIDEO);
    video.size(width, height);
    video.hide();

    poseNet = ml5.poseNet(video, 'single', modelReady);
    poseNet.on('pose', function (results) {
        poses = results;
    });

    let button = createButton("Change Mode");
    button.position(10, 10);
    button.mousePressed(changeMode);

    // Inicjalizacja mikrofonu
    mic = new p5.AudioIn();
    amp = new p5.Amplitude();
    startMic(); // Automatyczne uruchomienie mikrofonu

    // Uruchomienie podkładu muzycznego
    userStartAudio().then(() => {
        bgMusic.loop(); // Odtwarza muzykę w pętli
        bgMusic.setVolume(0.5); // Ustawienie głośności na 50%
    });
}

function startMic() {
    userStartAudio().then(() => {
        console.log("Audio context started");
        mic.start(() => {
            console.log("Microphone started successfully");
            micActive = true;
            amp.setInput(mic);
        });
    }).catch((err) => {
        console.error("Audio context error:", err);
    });
}

function modelReady() {
    console.log("PoseNet is ready");
}

// Przełączanie trybów
function changeMode() {
    mode = (mode + 1) % 3;
}

function draw() {
    translate(width, 0);
    scale(-1, 1);

    // Pobieramy poziom dźwięku do efektów
    if (micActive) {
        let level = amp.getLevel();
        pulseFactor = map(level, 0, 0.3, 0, 30); 
        console.log("Mic Level:", level); // Debugowanie poziomu dźwięku
    }

    if (mode === 2) {
        drawDistortedGrid(); // Siatka + dźwięk
    } else {
        if (mode === 0) {
            image(video, 0, 0, width, height); // Wideo + efekty
        } else {
            background(0); // Czarny ekran + efekty
        }
        drawKeypoints();
        updateParticles();
    }
}



function getPersonBoundingBox() {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;
    for (let i = 0; i < poses.length; i++) {
      let pose = poses[i].pose;
      for (let keypoint of pose.keypoints) {
        // Używamy wyższego progu pewności, np. 0.5
        if (keypoint.score > 0.5) {
          found = true;
          minX = min(minX, keypoint.position.x);
          minY = min(minY, keypoint.position.y);
          maxX = max(maxX, keypoint.position.x);
          maxY = max(maxY, keypoint.position.y);
        }
      }
    }
    if (found) {
      // Opcjonalnie dodajemy margines
      let margin = 50;
      minX = max(0, minX - margin);
      minY = max(0, minY - margin);
      maxX = min(width, maxX + margin);
      maxY = min(height, maxY + margin);
      return { minX, minY, maxX, maxY };
    } else {
      return null;
    }
  }
  


// Rysowanie siatki reagującej na ruch + dźwięk
function drawDistortedGrid() {
    background(0);
    stroke(255, 130);
    strokeWeight(1);
  

    let gridSize = 35 + pulseFactor;
    let distortions = [];
    // Zbieramy punkty z kluczowych punktów z wyższym progiem pewności
    for (let i = 0; i < poses.length; i++) {
      let pose = poses[i].pose;
      for (let keypoint of pose.keypoints) {
        if (keypoint.score > 0.5) {
          distortions.push({ x: keypoint.position.x, y: keypoint.position.y });
        }
      }
    }
    
    // Obliczamy bounding box, ale go nie używamy do ograniczenia całego rysowania
    let bbox = getPersonBoundingBox();
  

    // Rysujemy pionowe linie siatki na całym kanwie
    for (let x = 0; x < width; x += gridSize) {
      beginShape();
      for (let y = 0; y < height; y += gridSize) {
        let bendX = x, bendY = y;
        // Jeśli bounding box istnieje i punkt leży w jego obrębie, zastosuj deformację
        if (bbox && x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY) {
          for (let d of distortions) {
            let distance = dist(x, y, d.x, d.y);
            if (distance < 150) { 
              let force = map(distance, 0, 120, 0, 0);
              let angle = atan2(y - d.y, x - d.x);
              bendX -= cos(angle) * force;
              bendY -= sin(angle) * force;
            }
          }
        }
        vertex(bendX, bendY);
      }
      endShape();
    }
  
    // Rysujemy poziome linie siatki na całym kanwie
    for (let y = 0; y < height; y += gridSize) {
      beginShape();
      for (let x = 0; x < width; x += gridSize) {
        let bendX = x, bendY = y;
        if (bbox && x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY) {
          for (let d of distortions) {
            let distance = dist(x, y, d.x, d.y);
            if (distance < 150) {
              let force = map(distance, 0, 150, 40, 0);
              let angle = atan2(y - d.y, x - d.x);
              bendX -= cos(angle) * force;
              bendY -= sin(angle) * force;
            }
          }
        }
        vertex(bendX, bendY);
      }
      endShape();
    }
  }
  
  

// Lista kluczowych punktów dla twarzy i dłoni
const faceParts = ["nose", "leftEye", "rightEye", "leftEar", "rightEar"];
const handParts = ["leftWrist", "rightWrist"];

// Rysowanie kluczowych punktów i wywołanie efektu eksplozji
function drawKeypoints() {
    for (let i = 0; i < poses.length; i++) {
        let pose = poses[i].pose;
        for (let j = 0; j < pose.keypoints.length; j++) {
            let keypoint = pose.keypoints[j];

            if (keypoint.score > 0.2) {
                let x = keypoint.position.x;
                let y = keypoint.position.y;

                // Sprawdzenie, czy punkt jest twarzą czy dłonią
                let isFace = faceParts.includes(keypoint.part);
                let isHand = handParts.includes(keypoint.part);

                // Dodanie eksplozji - inne kształty dla twarzy i rąk
                for (let k = 0; k < 5; k++) {
                    particles.push(new Particle(x, y, isFace, isHand));
                }
            }
        }
    }
}

// Klasa reprezentująca pojedynczą cząsteczkę eksplozji
class Particle {
    constructor(x, y, isFace, isHand) {
        this.x = x;
        this.y = y;
        this.vx = random(-3, 3); // Losowa prędkość X
        this.vy = random(-3, 3); // Losowa prędkość Y
        this.alpha = 255; // Stopniowe zanikanie
        this.size = isHand ? random(10, 20) : random(10, 20); // Większy początkowy rozmiar dla dłoni
        this.isFace = isFace;
        this.isHand = isHand;

        // Kształty dla twarzy i dłoni
        if (isFace) {
            this.shape = int(random(3)); // 0 = koło, 1 = kwadrat, 2 = trójkąt
        } else if (isHand) {
            this.shape = 5; // 5 = pusty okrąg
        }

        this.color = [random(100, 255), random(100, 255), random(100, 255)];
    }

    update() {
        // Jeśli to dłoń – pusty okrąg powoli się powiększa zamiast poruszać
        if (this.isHand) {
            this.size += 2; // Powolne zwiększanie rozmiaru
            this.alpha -= 3; // Powolne zanikanie
        } else {
            // Standardowe poruszanie dla cząsteczek twarzy
            this.x += this.vx;
            this.y += this.vy;
        }

        // Odbijanie od ścian (tylko dla poruszających się elementów)
        if (this.isFace) {
            if (this.x <= 0 || this.x >= width) {
                this.vx *= -0.8;
                this.x = constrain(this.x, 1, width - 1);
            }
            if (this.y <= 0 || this.y >= height) {
                this.vy *= -0.8;
                this.y = constrain(this.y, 1, height - 1);
            }
        }

        // Stopniowe zanikanie
        this.alpha -= 3;

        // Jeśli jest niewidoczna, usuń ją
        if (this.alpha < 0 || this.size > 100) { // Maksymalna wielkość okręgu
            let index = particles.indexOf(this);
            particles.splice(index, 1);
        }
    }

    show() {
        noFill();
        stroke(this.color[0], this.color[1], this.color[2], this.alpha);
        strokeWeight(2);

        if (this.shape === 0) {
            fill(this.color[0], this.color[1], this.color[2], this.alpha);
            ellipse(this.x, this.y, this.size); // Koło (dla twarzy)
        } else if (this.shape === 1) {
            rect(this.x, this.y, this.size, this.size); // Kwadrat (dla twarzy)
        } else if (this.shape === 2) {
            triangle(
                this.x, this.y - this.size / 2,
                this.x - this.size / 2, this.y + this.size / 2,
                this.x + this.size / 2, this.y + this.size / 2
            ); // Trójkąt (dla twarzy)
        } else if (this.shape === 5) {
            ellipse(this.x, this.y, this.size); // Pusty okrąg (dla dłoni)
        }
    }
}

// Aktualizacja i rysowanie cząsteczek
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].show();
    }
} 

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    video.size(width, height);
}
