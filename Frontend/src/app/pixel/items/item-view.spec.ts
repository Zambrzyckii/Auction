const stubContext = (drawImage: () => void, clearRect: () => void) => ({
  measureText: () => ({ width: 0 }),
  fillText: () => undefined,
  clearRect,
  getImageData: (_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  }),
  createImageData: (w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  }),
  putImageData: () => undefined,
  drawImage,
});

describe('ItemView', () => {
  const drawImage = vi.fn();
  const clearRect = vi.fn();

  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => stubContext(drawImage, clearRect) as unknown as CanvasRenderingContext2D,
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    drawImage.mockClear();
    clearRect.mockClear();
  });

  it('draws the icon on construction and again on update', async () => {
    const { ItemView } = await import('./item-view');
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const view = new ItemView(canvas, { name: 'Old Radio', rarity: 'Common' });
    expect(drawImage).toHaveBeenCalledTimes(1);
    const [icon, x, y] = drawImage.mock.calls[0];
    expect([icon.width, icon.height, x, y]).toEqual([32, 32, 0, 0]);
    view.update('Old Radio', 'Rare');
    expect(clearRect).toHaveBeenCalled();
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('reuses the cached canvas when the same icon is drawn again', async () => {
    const { ItemView } = await import('./item-view');
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const view = new ItemView(canvas, { name: 'Old Radio', rarity: 'Common' });
    view.update('Old Radio', 'Common');
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls[1][0]).toBe(drawImage.mock.calls[0][0]);
  });

  it('draws the mystery icon for a null name', async () => {
    const { ItemView } = await import('./item-view');
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    new ItemView(canvas, { name: null, rarity: 'Common' });
    expect(drawImage).toHaveBeenCalledTimes(1);
  });
});
