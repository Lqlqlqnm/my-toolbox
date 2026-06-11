import { useState, useEffect, useCallback, createContext, useContext } from 'react'

// ===== Types =====
interface ModalOptions {
  title: string
  message?: string
  type: 'alert' | 'confirm' | 'prompt'
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  inputType?: string
}

interface ModalState extends ModalOptions {
  resolve: (value: string | boolean | null) => void
}

// ===== Context =====
const ModalContext = createContext<{
  showAlert: (title: string, message?: string) => Promise<void>
  showConfirm: (title: string, message?: string) => Promise<boolean>
  showPrompt: (title: string, options?: { defaultValue?: string; placeholder?: string; inputType?: string }) => Promise<string | null>
} | null>(null)

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}

// ===== Provider =====
export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null)
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    if (modal?.type === 'prompt') {
      setInputValue(modal.defaultValue || '')
    }
  }, [modal])

  const showAlert = useCallback((title: string, message?: string): Promise<void> => {
    return new Promise(resolve => {
      setModal({ title, message, type: 'alert', resolve: () => resolve(), confirmText: '确定' })
    })
  }, [])

  const showConfirm = useCallback((title: string, message?: string): Promise<boolean> => {
    return new Promise(resolve => {
      setModal({ title, message, type: 'confirm', resolve: (v) => resolve(v as boolean), confirmText: '确定', cancelText: '取消' })
    })
  }, [])

  const showPrompt = useCallback((title: string, options?: { defaultValue?: string; placeholder?: string; inputType?: string }): Promise<string | null> => {
    return new Promise(resolve => {
      setModal({
        title,
        type: 'prompt',
        defaultValue: options?.defaultValue || '',
        placeholder: options?.placeholder || '',
        inputType: options?.inputType || 'text',
        resolve: (v) => resolve(v as string | null),
        confirmText: '确定',
        cancelText: '取消',
      })
    })
  }, [])

  function handleConfirm() {
    if (!modal) return
    if (modal.type === 'alert') modal.resolve(true)
    else if (modal.type === 'confirm') modal.resolve(true)
    else if (modal.type === 'prompt') modal.resolve(inputValue)
    setModal(null)
  }

  function handleCancel() {
    if (!modal) return
    if (modal.type === 'confirm') modal.resolve(false)
    else if (modal.type === 'prompt') modal.resolve(null)
    setModal(null)
  }

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={modal.type === 'alert' ? handleConfirm : handleCancel} />
          {/* Dialog */}
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 animate-[scale-in_0.15s_ease-out]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{modal.title}</h3>
            {modal.message && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{modal.message}</p>}

            {modal.type === 'prompt' && (
              <input
                autoFocus
                type={modal.inputType || 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder={modal.placeholder}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 mb-4"
              />
            )}

            <div className="flex gap-3 mt-4">
              {modal.type !== 'alert' && (
                <button onClick={handleCancel}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {modal.cancelText}
                </button>
              )}
              <button onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors">
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}
