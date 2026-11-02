# Thức Giấc

Game sinh tồn lén lút 3D (Three.js): quái vật khổng lồ trỗi dậy giữa thành phố, bạn phải tìm đường về nhà.

**Chơi:** https://truoyang.github.io/gameprompted-1/

## Cấu trúc
- `index.html` + `three.module.min.js`: bản chơi được (GitHub Pages phục vụ từ thư mục gốc).
- `src/`: mã nguồn (`page.html` + các file `0x_*.js`).
- `build.mjs`: `node build.mjs` ghép `src/` thành `web/index.html`; chép `web/index.html` ra gốc repo để cập nhật bản chơi.
