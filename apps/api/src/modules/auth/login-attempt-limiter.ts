interface AttemptState {
  failures: number
  resetAt: number
}

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptState>()

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly now = () => Date.now(),
  ) {}

  retryAfter(key: string) {
    const state = this.current(key)
    if (!state || state.failures < this.maxFailures) return 0
    return Math.max(1, Math.ceil((state.resetAt - this.now()) / 1000))
  }

  fail(key: string) {
    const state = this.current(key)
    if (state) state.failures += 1
    else this.attempts.set(key, { failures: 1, resetAt: this.now() + this.windowMs })
  }

  success(key: string) { this.attempts.delete(key) }

  private current(key: string) {
    const state = this.attempts.get(key)
    if (state && state.resetAt <= this.now()) {
      this.attempts.delete(key)
      return undefined
    }
    return state
  }
}
