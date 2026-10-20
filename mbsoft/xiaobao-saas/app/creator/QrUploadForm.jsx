'use client'
// 收款二维码表单：客户端读图转 data URL 预览后提交，支持清除。
// 图片不落服务器文件系统，直接以 data URL 存入 tenants.pay_qr。

import { useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import { savePayQrAction } from '@/app/actions/creator'
import SubmitButton from '@/app/components/SubmitButton'

/** 文件大小上限：约 700KB 图片（data URL 后约 1MB 字符） */
const MAX_BYTES = 700 * 1024

/**
 * 收款二维码上传表单。
 * @param {{payQr: string}} props 当前已绑定的二维码 data URL
 */
export default function QrUploadForm({ payQr }) {
  const [state, formAction] = useFormState(savePayQrAction, {})
  const [preview, setPreview] = useState(payQr || '')
  const [fileError, setFileError] = useState('')
  const fileRef = useRef(null)

  /** 选图后本地校验并转 data URL 预览 */
  function onFile(e) {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFileError('请选择图片文件')
      e.target.value = ''
      return
    }
    if (file.size > MAX_BYTES) {
      setFileError('图片过大（限 700KB），请压缩后再上传')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreview(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  return (
    <form action={formAction}>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      {fileError ? <p className="alert alert--error">{fileError}</p> : null}
      <div className="qrUpload">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="qrUploadImg" src={preview} alt="收款二维码" />
        ) : (
          <div className="qrUploadEmpty">未绑定</div>
        )}
        <div className="qrUploadOps">
          <input
            ref={fileRef}
            type="file"
            name="qrFile"
            accept="image/*"
            onChange={onFile}
          />
          {preview ? <small>保存后读者购买时将扫码直接向你付款</small> : null}
        </div>
      </div>
      <input type="hidden" name="dataUrl" value={preview} />
      <div className="formActions">
        <SubmitButton variant="secondary">保存二维码</SubmitButton>
        {preview ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setPreview('')
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            清除
          </button>
        ) : null}
      </div>
    </form>
  )
}
