// Shrinks a chosen photo in the browser (to about 100 KB) so it can be sent and
// saved safely. Returns a JPEG data URL.
export function shrinkPhoto(file, maxChars = 110000) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("Use a JPG, PNG or WEBP photo."));
    if (file.size > 10 * 1024 * 1024) return reject(new Error("Photo is too large (max 10 MB)."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let max = 760;
      let quality = 0.72;
      let out = "";
      for (let i = 0; i < 8; i += 1) {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", quality);
        if (out.length <= maxChars) break;
        max = Math.round(max * 0.85);
        quality = Math.max(0.4, quality - 0.07);
      }
      URL.revokeObjectURL(url);
      if (out.length <= maxChars + 20000) resolve(out);
      else reject(new Error("That photo is too detailed. Try another one."));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that photo.")); };
    img.src = url;
  });
}