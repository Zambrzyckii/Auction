export const SCENE_FONTS: readonly string[] = [
  '8px "Tiny5"',
  '11px "Micro 5"',
  '27px "Jersey 15"',
  '21px "Jacquard 12"',
];

export async function fontsReady(fonts: FontFaceSet, timeoutMs = 4000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const loaded = Promise.allSettled(SCENE_FONTS.map((font) => fonts.load(font))).then(
    () => undefined,
  );
  try {
    await Promise.race([loaded, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
