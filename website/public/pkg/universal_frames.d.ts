/* tslint:disable */
/* eslint-disable */
export function calculate(input: string): string;
export function defaults(): string;
export function start(): void;
export function apply_location(zip: string, lat: number, lon: number): void;
export function show_status(message: string): void;
export function load_design(json: string): boolean;
export function apply_photo(read: string): string;
export function set_units(metric: boolean): void;
export function pick_scene(input: string): void;
export function apply_model(seq: number, json: string): void;
export function resize_wall(input: string): void;
export function draw_wall(input: string): void;
export function preview_placement(input: string): string;
export function generate_design(input: string, mode: string, seed: number, keep_size: boolean): string;
export function apply_texture(input: string): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly calculate: (a: number, b: number, c: number) => void;
  readonly defaults: (a: number) => void;
  readonly start: () => void;
  readonly apply_location: (a: number, b: number, c: number, d: number) => void;
  readonly show_status: (a: number, b: number) => void;
  readonly load_design: (a: number, b: number) => number;
  readonly apply_photo: (a: number, b: number, c: number) => void;
  readonly set_units: (a: number) => void;
  readonly pick_scene: (a: number, b: number) => void;
  readonly apply_model: (a: number, b: number, c: number) => void;
  readonly resize_wall: (a: number, b: number) => void;
  readonly draw_wall: (a: number, b: number) => void;
  readonly preview_placement: (a: number, b: number, c: number) => void;
  readonly generate_design: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly apply_texture: (a: number, b: number) => void;
  readonly __wbindgen_export_0: (a: number) => void;
  readonly __wbindgen_export_1: (a: number, b: number) => number;
  readonly __wbindgen_export_2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export_5: (a: number, b: number) => void;
  readonly __wbindgen_export_6: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
