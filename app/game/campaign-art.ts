/** Procedural campaign artwork. All geometry shares a fixed, unwarped silhouette. */
export function drawTyrant(ctx: CanvasRenderingContext2D, damage = 0): void {
  const stage = Math.max(0, Math.min(3, Math.floor(damage)));
  ctx.clearRect(0, 0, 320, 240);
  ctx.lineJoin = 'miter';
  const poly = (points: number[][], fill: string, stroke = '#090e16', width = 3) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke();
  };
  const line = (points: number[][], color: string, width = 2) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  // Swept, serrated armor: no rounded face, cartoon eyes, or elastic body animation.
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(160, 0); ctx.scale(side, 1);
    poly([[30, 67], [69, 35], [108, 21], [99, 57], [140, 41], [126, 78], [153, 81], [132, 116], [148, 136], [108, 128], [122, 162], [76, 143], [43, 118]], '#182d33');
    poly([[36, 78], [81, 58], [127, 56], [107, 83], [134, 91], [114, 108], [66, 103], [43, 115]], stage > 1 ? '#37333a' : '#3f3959', '#111821');
    poly([[48, 105], [89, 115], [109, 144], [90, 141], [105, 184], [78, 169], [86, 205], [62, 178], [52, 141]], '#243a3c');
    poly([[59, 108], [83, 126], [84, 151], [68, 138]], '#55685a', '#162c2a', 2);
    line([[49, 86], [77, 71], [108, 67]], '#839383', 3);
    line([[57, 96], [85, 87], [106, 89]], stage > 1 ? '#df8747' : '#6ccf9c', 2);
    line([[64, 122], [72, 139], [77, 165]], '#9e8955', 2);
    // Thorn crown projects upward from the carapace, rather than a smiling head.
    poly([[13, 75], [25, 34], [30, 10], [41, 45], [55, 26], [49, 61], [35, 89]], '#314348');
    line([[26, 63], [32, 31], [38, 57]], '#9da481', 2);
    if (stage >= 1) line([[75, 71], [67, 87], [82, 98], [66, 116]], '#f3a85d', 2);
    if (stage >= 2) poly([[111, 87], [91, 95], [105, 117], [85, 106]], '#090e16', '#d4804e', 1);
    ctx.restore();
  }
  // Faceted central armor and recessed reactor; narrow visor, no mouth.
  poly([[160, 29], [189, 55], [203, 106], [195, 156], [179, 184], [170, 213], [160, 235], [150, 213], [141, 184], [125, 156], [117, 106], [131, 55]], '#0f252b');
  poly([[160, 38], [185, 62], [183, 98], [160, 117], [137, 98], [135, 62]], '#5d526d');
  poly([[160, 42], [174, 65], [170, 83], [160, 91], [150, 83], [146, 65]], '#84927c', '#243739', 2);
  poly([[137, 91], [160, 98], [183, 91], [179, 105], [160, 111], [141, 105]], '#070f13');
  line([[142, 100], [156, 104]], '#f2c77a', 3); line([[164, 104], [178, 100]], '#f2c77a', 3);
  poly([[160, 117], [189, 110], [193, 144], [178, 169], [160, 185], [142, 169], [127, 144], [131, 110]], '#44505b');
  poly([[160, 120], [179, 139], [173, 161], [160, 175], [147, 161], [141, 139]], '#0a141d', '#99aa73', 2);
  const glow = ctx.createRadialGradient(160, 147, 1, 160, 147, 28);
  glow.addColorStop(0, stage >= 2 ? '#ffe2a1' : '#d6ffc9');
  glow.addColorStop(.3, stage >= 2 ? '#ef793e' : '#73ddb3');
  glow.addColorStop(1, '#112a35');
  poly([[160, 125], [175, 141], [170, 158], [160, 169], [150, 158], [145, 141]], '#18382f', '#18232e', 1);
  ctx.fillStyle = glow; ctx.fill();
  poly([[149, 180], [160, 185], [171, 180], [168, 204], [160, 220], [152, 204]], '#637666');
  line([[160, 189], [160, 211]], '#b9bb83', 2);
  if (stage >= 1) line([[138, 58], [151, 75], [143, 86]], '#e1ab70', 2);
  if (stage >= 2) line([[181, 117], [172, 127], [181, 145], [171, 157]], '#f6c177', 3);
  if (stage >= 3) {
    line([[135, 136], [143, 150], [132, 155], [149, 174]], '#ffce87', 3);
    line([[170, 53], [162, 66], [171, 78]], '#e49255', 2);
  }
}

export function drawVictoryMedal(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, 240, 200);
  ctx.strokeStyle = '#d6b768'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(120, 99, 77, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#3b6654'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(120, 99, 69, 0, Math.PI * 2); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(120, 100); ctx.scale(side, 1);
    ctx.strokeStyle = '#a2844f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, 88); ctx.bezierCurveTo(88, 65, 110, 2, 66, -66); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = -.72 + i * .23, x = Math.cos(a) * 86, y = Math.sin(a) * 85;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a - .8);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(21, -15, 27, -2); ctx.quadraticCurveTo(12, 9, 0, 0);
      ctx.fillStyle = i % 2 ? '#c6a55d' : '#f0d28b'; ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
}
