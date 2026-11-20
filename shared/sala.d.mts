export type Pessoa = { id: string; nome: string; avatar?: string };
export type Membro = { id: string; nome: string; avatar: string; entrouEm: number; vistoEm: number; naChamada: boolean; mudo: boolean; digitando: number };
export type Sala = { codigo: string; nome: string; criadoEm: number; donoId: string; mineDigitando: number; membros: Membro[] };
export type MembroVisto = { id: string; nome: string; avatar: string; eu: boolean; online: boolean; naChamada: boolean; mudo: boolean; digitando: boolean };
export type VistaSala = { codigo: string; nome: string; souDono: boolean; mineDigitando: boolean; membros: MembroVisto[] };
export type MensagemSala = { id: number; tipo: "texto" | "mine" | "sistema"; autorId: string; autor: string; texto: string; temFoto: boolean; em: number };

export const SALA_MAX_MEMBROS: number;
export const SALA_MAX_CHAMADA: number;
export const SALA_ONLINE_MS: number;
export const SALA_TEXTO_MAX: number;
export const SALA_FOTO_MAX: number;

export function novoCodigoSala(aleatorio?: () => number): string;
export function codigoSalaValido(codigo: unknown): boolean;
export function limparNomeSala(nome: unknown): string;
export function criarSala(args: { codigo: string; nome: string; dono: Pessoa; agora: number }): Sala;
export function estaOnline(membro: Membro, agora: number): boolean;
export function entrarNaSala(sala: Sala, pessoa: Pessoa, agora: number): { ok: boolean; novo?: boolean; erro?: string };
export function sairDaSala(sala: Sala, id: string): boolean;
export function tocarNaSala(sala: Sala, id: string, agora: number, info?: { naChamada?: boolean; mudo?: boolean; digitando?: boolean }): { ok: boolean; aviso?: string; erro?: string };
export function vistaSala(sala: Sala, id: string, agora: number): VistaSala;
export function limparTextoMensagem(texto: unknown): string;
export function fotoValida(foto: unknown): boolean;
export function chamaMine(texto: string): boolean;
export function conversaParaMine(mensagens: Array<Pick<MensagemSala, "tipo" | "autor" | "texto" | "temFoto">>, limite?: number): string;
