import { describe, expect, test } from 'vitest'
import {
  generateAndWrapDek,
  unwrapDek,
  importDek,
  encryptJSON,
  decryptJSON,
} from '@/lib/crypto'

describe('record encryption', () => {
  test('encryptJSON + decryptJSON round-trips', async () => {
    const { dekBytes } = await generateAndWrapDek('passphrase-12345')
    const dek = await importDek(dekBytes)

    const value = { v: 1, amount: 1250, category: 'food', description: 'lunch' }
    const ct = await encryptJSON(value, dek)
    const out = await decryptJSON<typeof value>(ct, dek)

    expect(out).toEqual(value)
  })

  test('decryptJSON rejects with a different DEK', async () => {
    const a = await generateAndWrapDek('one')
    const b = await generateAndWrapDek('two')
    const dekA = await importDek(a.dekBytes)
    const dekB = await importDek(b.dekBytes)

    const ct = await encryptJSON({ secret: 'x' }, dekA)
    await expect(decryptJSON(ct, dekB)).rejects.toThrow()
  })

  test('every encryption produces a different ciphertext (fresh IV)', async () => {
    const { dekBytes } = await generateAndWrapDek('p')
    const dek = await importDek(dekBytes)
    const value = { same: 'plaintext' }

    const ct1 = await encryptJSON(value, dek)
    const ct2 = await encryptJSON(value, dek)

    expect(ct1).not.toEqual(ct2)
    expect(await decryptJSON(ct1, dek)).toEqual(value)
    expect(await decryptJSON(ct2, dek)).toEqual(value)
  })
})

describe('DEK wrap / unwrap', () => {
  test('round-trips with the same passphrase', async () => {
    const { dekBytes, wrapped } = await generateAndWrapDek('passphrase-12345')
    const recovered = await unwrapDek('passphrase-12345', wrapped)
    expect(Array.from(recovered)).toEqual(Array.from(dekBytes))
  })

  test('throws on wrong passphrase (auth tag mismatch)', async () => {
    const { wrapped } = await generateAndWrapDek('correct')
    await expect(unwrapDek('wrong', wrapped)).rejects.toThrow()
  })

  test('different setups produce different wrapped material', async () => {
    const a = await generateAndWrapDek('p')
    const b = await generateAndWrapDek('p')
    // Same passphrase, but fresh salt + DEK each time → different output
    expect(a.wrapped.wrappedDek).not.toEqual(b.wrapped.wrappedDek)
    expect(a.wrapped.salt).not.toEqual(b.wrapped.salt)
  })

  test('reports the iteration count used', async () => {
    const { wrapped } = await generateAndWrapDek('p')
    expect(wrapped.iterations).toBe(600_000)
  })
})
