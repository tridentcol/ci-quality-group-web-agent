import { describe, expect, it } from 'vitest'
import { normalize } from './normalize'

describe('normalize', () => {
  it('Messenger entrante', () => {
    const out = normalize({
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'U1' }, recipient: { id: 'PAGE' }, message: { mid: 'm1', text: 'hola' } }] }],
    })
    expect(out).toEqual([
      { channel: 'messenger', externalId: 'U1', text: 'hola', messageId: 'm1', isEcho: false, kind: 'text' },
    ])
  })

  it('Messenger echo → isEcho y externalId = destinatario', () => {
    const out = normalize({
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'PAGE' }, recipient: { id: 'U1' }, message: { mid: 'm2', text: 'le respondo', is_echo: true } }] }],
    })
    expect(out[0]).toMatchObject({ isEcho: true, externalId: 'U1' })
  })

  it('echo del propio bot (con app_id) se ignora → no falso relevo humano', () => {
    const out = normalize({
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'PAGE' }, recipient: { id: 'U1' }, message: { mid: 'm3', text: 'respuesta del bot', is_echo: true, app_id: 123456 } }] }],
    })
    expect(out).toEqual([])
  })

  it('Instagram entrante (mismo formato page)', () => {
    const out = normalize({
      object: 'instagram',
      entry: [{ messaging: [{ sender: { id: 'IGU' }, recipient: { id: 'IGP' }, message: { mid: 'ig1', text: 'hola ig' } }] }],
    })
    expect(out[0]).toMatchObject({ channel: 'instagram', externalId: 'IGU' })
  })

  it('WhatsApp con nombre de contacto', () => {
    const out = normalize({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { contacts: [{ wa_id: '573001', profile: { name: 'Ana' } }], messages: [{ from: '573001', id: 'wamid1', type: 'text', text: { body: 'precio cobre' } }] } }] }],
    })
    expect(out[0]).toMatchObject({ channel: 'whatsapp', externalId: '573001', customerName: 'Ana', text: 'precio cobre' })
  })

  it('mensaje sin texto con adjunto → kind:unsupported (ya no se ignora en silencio)', () => {
    const out = normalize({
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'U1' }, recipient: { id: 'P' }, message: { mid: 'm', attachments: [{ type: 'image' }] } }] }],
    })
    expect(out).toEqual([
      { channel: 'messenger', externalId: 'U1', text: '', messageId: 'm', isEcho: false, kind: 'unsupported', unsupportedType: 'image' },
    ])
  })

  it('sin texto ni adjuntos (recibo de entrega/lectura) → sí se ignora', () => {
    const out = normalize({
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'U1' }, recipient: { id: 'P' }, message: { mid: 'm', is_deleted: false } }] }],
    })
    expect(out).toEqual([])
  })

  it('echo humano sin texto (solo mandó una foto desde la bandeja) → igual toma el control', () => {
    const out = normalize({
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'PAGE' }, recipient: { id: 'U1' }, message: { mid: 'm', is_echo: true, attachments: [{ type: 'image' }] } }] }],
    })
    expect(out).toEqual([
      { channel: 'messenger', externalId: 'U1', text: '[adjunto sin texto]', messageId: 'm', isEcho: true, kind: 'text' },
    ])
  })

  it('WhatsApp con imagen (no-texto) → kind:unsupported', () => {
    const out = normalize({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ from: '573001', id: 'wamid2', type: 'image' }] } }] }],
    })
    expect(out).toEqual([
      { channel: 'whatsapp', externalId: '573001', text: '', messageId: 'wamid2', isEcho: false, kind: 'unsupported', unsupportedType: 'image', customerName: undefined },
    ])
  })

  it('objeto desconocido o cuerpo inválido → []', () => {
    expect(normalize({ object: 'otra_cosa' })).toEqual([])
    expect(normalize(null)).toEqual([])
    expect(normalize('x')).toEqual([])
  })

  it('postback de Messenger → payload como texto', () => {
    const out = normalize({
      object: 'page',
      entry: [
        {
          messaging: [
            { sender: { id: 'U9' }, recipient: { id: 'P' }, timestamp: 1730000000000, postback: { title: 'Ver precios', payload: 'VER_PRECIOS' } },
          ],
        },
      ],
    })
    expect(out[0]).toMatchObject({ channel: 'messenger', externalId: 'U9', text: 'VER_PRECIOS', isEcho: false })
    expect(out[0].messageId).toBeTruthy()
  })
})
