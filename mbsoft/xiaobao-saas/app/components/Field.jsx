/** 表单字段：支持 text / textarea / select / number 等类型，带提示与错误文案 */
export default function Field({
  label,
  name,
  type,
  defaultValue,
  placeholder,
  required,
  hint,
  error,
  options,
  rows,
  min,
  step,
  disabled,
}) {
  const id = `field-${name}`

  let control = null
  if (type === 'textarea') {
    control = (
      <textarea
        id={id}
        name={name}
        rows={rows || 4}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    )
  } else if (type === 'select') {
    control = (
      <select id={id} name={name} defaultValue={defaultValue} required={required} disabled={disabled}>
        {(options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  } else {
    control = (
      <input
        id={id}
        name={name}
        type={type || 'text'}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        disabled={disabled}
      />
    )
  }

  return (
    <div className="field">
      {label ? (
        <label htmlFor={id}>
          {label}
          {required ? ' *' : null}
        </label>
      ) : null}
      {control}
      {hint ? <span className="fieldHint">{hint}</span> : null}
      {error ? <span className="fieldError">{error}</span> : null}
    </div>
  )
}
