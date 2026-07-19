declare module 'react-native-argon2' {
  export interface Argon2Options {
    iterations?: number;
    memory?: number;
    parallelism?: number;
    hashLength?: number;
    mode?: 'argon2d' | 'argon2i' | 'argon2id';
  }

  export interface Argon2Result {
    /** Hex-encoded raw hash of length hashLength * 2. */
    rawHash: string;
    /** Encoded hash string (PHC format). */
    encodedHash: string;
  }

  export default function argon2(
    password: string,
    salt: string,
    options?: Argon2Options,
  ): Promise<Argon2Result>;
}
