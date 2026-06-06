# Chained by Other People's Shadows

**Chained by Other People's Shadows** adalah game naratif 2D berbasis Phaser tentang Raka, seseorang yang terus mengejar produktivitas sampai hidupnya terasa seperti daftar tugas yang tidak pernah selesai.

Game ini menggabungkan walking simulator, visual novel, dan minigame kerja berbasis input panah. Pemain bergerak di kamar Raka, membaca percakapan, menerima notifikasi dari orang-orang terdekat, dan mengulang rutinitas kerja sampai tekanan yang ia abaikan mulai mengambil bentuk.

## Tentang Game

Raka merasa semua orang bergerak lebih cepat darinya. Teman-temannya punya rencana, keluarganya menunggu kabar, dan suara di kepalanya terus mengingatkan bahwa berhenti berarti tertinggal.

Di dalam kamar kecilnya, laptop menjadi pusat dunia. Setiap pekerjaan memberi uang, tetapi juga membuka dialog baru, pesan dari keluarga, ajakan teman, panggilan waktu ibadah, dan potongan refleksi yang makin berat. Game ini bertanya satu hal sederhana:

> Kalau semuanya sudah dikejar, sebenarnya apa yang sedang kita cari?

## Fitur Saat Ini

- **Visual novel overlay** dengan dialog typewriter, pilihan jawaban, prompt interaksi, dan ending screen.
- **Walking simulator 2D** dengan click-to-move, keyboard movement, dan interaction prompt.
- **Minigame kerja berbasis arrow input** yang meminta pemain menekan urutan panah dalam beberapa loop.
- **Progress cerita berbasis uang**. Setiap kerja di laptop memberi `$25` dan memicu event tertentu di threshold seperti `$50`, `$75`, `$150`, `$200`, `$275`, `$350`, `$400`, dan `$475`.
- **Kamar tidur pixel-art berlapis** memakai asset bitmap untuk base, door, wardrobe, clock, bed, chair, desk, dan night overlay.
- **Siklus siang-malam** dengan perubahan frame jam, overlay malam, suara jangkrik, dan suara ayam.
- **Notifikasi in-world** untuk pesan ibu, pesan teman, dan waktu ibadah.
- **Cinematic video bridge** sebelum gameplay dimulai.
- **Replay phase dan ending** yang membuka kembali konsekuensi dari pilihan Raka.

## Cara Bermain

| Aksi | Kontrol |
| --- | --- |
| Bergerak | `WASD`, arrow keys, atau klik posisi tujuan |
| Interaksi | `E`, `Space`, atau klik objek/interaksi |
| Lanjut dialog | Klik tombol `Continue` atau tekan `Enter` |
| Pilih jawaban | Klik pilihan yang tersedia |
| Minigame kerja | Tekan arrow key sesuai urutan yang tampil |
| Tutup bubble monolog | `Enter` |

## Alur Permainan

1. Pemain membuka game dari title screen.
2. Video cinematic dimainkan sebelum masuk ke kamar Raka.
3. Raka memulai cerita di meja laptop.
4. Pemain menyelesaikan minigame panah untuk bekerja dan mendapat uang.
5. Semakin sering bekerja, semakin banyak dialog, notifikasi, dan event muncul.
6. Event makanan membuka interaksi pintu.
7. Pesan keluarga, pesan teman, dan waktu ibadah muncul sebagai bubble di dalam dunia game.
8. Tekanan kerja mencapai titik puncak dan membuka rangkaian refleksi menuju ending.

## Teknologi

- [Phaser 3](https://phaser.io/) untuk scene, canvas, sprite, audio, input, tween, dan camera fade.
- [TypeScript](https://www.typescriptlang.org/) untuk struktur kode dan tipe state game.
- [Vite](https://vite.dev/) untuk dev server dan build frontend.
- [Vitest](https://vitest.dev/) untuk test simulasi story state dan minigame.

## Struktur Project

```text
src/
  assets/
    manifest.ts              # Daftar key asset karakter, room, UI, dan audio
  game/
    content/
      dialogues.ts           # Semua node dialog dan pilihan cerita
      rooms.ts               # Definisi room dan interactable
    simulation/
      rules.ts               # Rule state, phase, minigame, reward, dan interaction
      state.ts               # Initial state game
      types.ts               # Type utama untuk game state, room, dialog, dan asset
  phaser/
    scenes/
      BootScene.ts           # Entry scene
      MenuScene.ts           # Title screen
      EpilogueScene.ts       # Video cinematic sebelum gameplay
      GameplayScene.ts       # Runtime utama game
    view/
      proceduralRoom.ts      # Render room, player, animasi, dan interactable
      mailBubble.ts          # Bubble pesan
      iconNotificationBubble.ts
      speechBubble.ts        # Bubble monolog in-world
  ui/
    NarrativeOverlay.ts      # DOM overlay untuk dialog, HUD, tutorial, minigame, ending
  main.ts                    # Konfigurasi Phaser game
  style.css                  # Styling overlay dan responsive layout
```

Asset publik berada di:

```text
public/assets/
  audio/
  characters/player/
  environment/bedroom/
  ui/
  video/
```

## Menjalankan Project

Install dependency:

```bash
npm install
```

Jalankan dev server:

```bash
npm run dev
```

Build production:

```bash
npm run build
```

Jalankan test:

```bash
npm run test
```

Secara default Vite memakai:

```text
http://127.0.0.1:5173
```

## Status Build

Project ini adalah playable prototype untuk game jam. Core loop, dialog utama, minigame kerja, notifikasi, day-night cycle, bedroom scene, cinematic video, dan test simulasi sudah tersedia.

Beberapa area masih bisa dikembangkan lebih jauh, seperti asset final untuk street/replay phase, balancing durasi event, polishing audio mix, dan penambahan build deployment.

## Tema

Game ini membahas:

- Toxic productivity
- Fear of missing out
- Burnout
- Hubungan keluarga dan pertemanan yang tertunda
- Perasaan tertinggal dari orang lain
- Pertanyaan tentang hidup yang tidak hanya diukur dari pencapaian

## License

Belum ada license publik yang didefinisikan di repo ini.
