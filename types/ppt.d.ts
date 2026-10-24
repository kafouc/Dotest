declare module 'ppt' {
  interface PPTUtils {
    to_text?(input: unknown): unknown;
  }

  interface PPTModule {
    parse_pptcfb(cfb: unknown, options?: unknown): unknown;
    utils?: PPTUtils;
  }

  const PPT: PPTModule;
  export default PPT;
}
