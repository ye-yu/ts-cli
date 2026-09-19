import { styleText } from "util";

type ForegroundColors =
  | "black"
  | "blackBright"
  | "blue"
  | "blueBright"
  | "cyan"
  | "cyanBright"
  | "gray"
  | "green"
  | "greenBright"
  | "grey"
  | "magenta"
  | "magentaBright"
  | "red"
  | "redBright"
  | "white"
  | "whiteBright"
  | "yellow"
  | "yellowBright";

type BackgroundColors =
  | "bgBlack"
  | "bgBlackBright"
  | "bgBlue"
  | "bgBlueBright"
  | "bgCyan"
  | "bgCyanBright"
  | "bgGray"
  | "bgGreen"
  | "bgGreenBright"
  | "bgGrey"
  | "bgMagenta"
  | "bgMagentaBright"
  | "bgRed"
  | "bgRedBright"
  | "bgWhite"
  | "bgWhiteBright"
  | "bgYellow"
  | "bgYellowBright";

type Modifiers =
  | "blink"
  | "bold"
  | "dim"
  | "doubleunderline"
  | "framed"
  | "hidden"
  | "inverse"
  | "italic"
  | "none"
  | "overlined"
  | "reset"
  | "strikethrough"
  | "underline";

type StyleFnCallback = {
  (text: any): string;
}

type StyleFn = StyleFnCallback & {
  [k in ForegroundColors]: StyleFn;
} & {
  [k in BackgroundColors]: StyleFn;
} & {
  [k in Modifiers]: StyleFn;
};

function createStyleFn(style: ForegroundColors | BackgroundColors | Modifiers | Array<ForegroundColors | BackgroundColors | Modifiers>): StyleFn {
  const cb: StyleFnCallback = (text: string) => styleText(style, String(text));
  return new Proxy<StyleFn>(cb as StyleFn, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      const styleArr = Array.isArray(style) ? style : [style];
      return createStyleFn([...styleArr, prop as ForegroundColors | BackgroundColors | Modifiers]);
    },
  });
}

export const black = createStyleFn("black")
export const blackBright = createStyleFn("blackBright")
export const blue = createStyleFn("blue")
export const blueBright = createStyleFn("blueBright")
export const cyan = createStyleFn("cyan")
export const cyanBright = createStyleFn("cyanBright")
export const gray = createStyleFn("gray")
export const green = createStyleFn("green")
export const greenBright = createStyleFn("greenBright")
export const grey = createStyleFn("grey")
export const magenta = createStyleFn("magenta")
export const magentaBright = createStyleFn("magentaBright")
export const red = createStyleFn("red")
export const redBright = createStyleFn("redBright")
export const white = createStyleFn("white")
export const whiteBright = createStyleFn("whiteBright")
export const yellow = createStyleFn("yellow")
export const yellowBright = createStyleFn("yellowBright")