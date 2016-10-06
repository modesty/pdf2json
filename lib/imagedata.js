function ImageData(width, height) {
  if (width instanceof ImageData) {
    this.width = width.width;
    this.height = width.height;
    this.data = width.data;
  } else {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }
};
  
module.exports = ImageData;
