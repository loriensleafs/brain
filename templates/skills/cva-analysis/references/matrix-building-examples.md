# CVA Matrix Building Examples (TypeScript Focus)

Complete worked examples of CVA analysis for common .NET scenarios.

## Example 1: Payment Processing (Abstract Factory)

### Phase 1: Identify Commonalities

**Use Cases**:

1. Credit card payment
2. PayPal payment
3. Bank transfer payment

**Commonalities** (ALL cases need):

- Validate payment amount
- Authorize transaction
- Record transaction
- Handle transaction errors

### Phase 2: Identify Variabilities

**Variations by payment method**:

| Commonality | Credit Card | PayPal | Bank Transfer |
|-------------|-------------|--------|---------------|
| How varies? | Card API | PayPal API | ACH API |

### Phase 3: CVA Matrix

| Commonality | Credit Card | PayPal | Bank Transfer |
|-------------|-------------|--------|---------------|
| Validate amount | Check card limit, validate CVV | Check PayPal balance, account status | Check account balance, routing number |
| Authorize transaction | Contact card issuer API | OAuth flow with PayPal | ACH authorization |
| Record transaction | Log to CardTransactionDB | Log to PayPalTransactionDB | Log to BankTransactionDB |
| Handle errors | Card decline codes (51, 05, etc.) | PayPal error codes | ACH rejection codes |

**Analysis**:

- Rows vary across columns (different implementations per method)
- Columns are coherent families (each method has consistent set of operations)
- → **Abstract Factory pattern**

### Phase 4: Pattern Recommendation

**Primary**: Abstract Factory Pattern

**Rationale**: Each payment method (column) requires a coherent family of related operations. Operations are not independent - they share payment method context.

**TypeScript Implementation**:

```typescript
// Abstract factory interface
interface PaymentFactory {
  createValidator(): AmountValidator;
  createAuthorizer(): TransactionAuthorizer;
  createRecorder(): TransactionRecorder;
  createErrorHandler(): ErrorHandler;
}

// Concrete factory: Credit Card
class CreditCardPaymentFactory implements PaymentFactory {
  createValidator(): AmountValidator { return new CreditCardValidator(); }
  createAuthorizer(): TransactionAuthorizer { return new CardIssuerAuthorizer(); }
  createRecorder(): TransactionRecorder { return new CardTransactionRecorder(); }
  createErrorHandler(): ErrorHandler { return new CardDeclineHandler(); }
}

// Concrete factory: PayPal
class PayPalPaymentFactory implements PaymentFactory {
  createValidator(): AmountValidator { return new PayPalBalanceValidator(); }
  createAuthorizer(): TransactionAuthorizer { return new PayPalOAuthAuthorizer(); }
  createRecorder(): TransactionRecorder { return new PayPalTransactionRecorder(); }
  createErrorHandler(): ErrorHandler { return new PayPalErrorHandler(); }
}

// Usage
class PaymentProcessor {
  private readonly factory: PaymentFactory;

  constructor(factory: PaymentFactory) {
    this.factory = factory;
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // All products from same family (cohesive)
    const validator = this.factory.createValidator();
    const authorizer = this.factory.createAuthorizer();
    const recorder = this.factory.createRecorder();
    const errorHandler = this.factory.createErrorHandler();

    // Workflow uses family of products
    if (!(await validator.validate(request))) {
      return errorHandler.handleValidationError();
    }

    const authResult = await authorizer.authorize(request);
    if (!authResult.isSuccess) {
      return errorHandler.handleAuthorizationError(authResult);
    }

    await recorder.record(authResult);
    return PaymentResult.success();
  }
}

// Factory registration
function createPaymentFactory(paymentMethod: string): PaymentFactory {
  switch (paymentMethod) {
    case "CreditCard": return new CreditCardPaymentFactory();
    case "PayPal": return new PayPalPaymentFactory();
    case "BankTransfer": return new BankTransferPaymentFactory();
    default: throw new Error(`Payment method ${paymentMethod} not supported`);
  }
}
```

**Alternative Considered**: Strategy pattern per row (4 separate strategies). **Rejected** because operations are not independent - they share payment method context. Keeping them in a factory maintains cohesion.

---

## Example 2: Middleware Pipeline (Abstract Factory)

### CVA Matrix

| Middleware Function | Development | Staging | Production |
|---------------------|-------------|---------|------------|
| Error Handling | Detailed exceptions, stack traces | Log only, generic errors to client | Generic errors, minimal info |
| Authentication | Dev tokens, relaxed validation | Staging tokens, moderate validation | Production tokens, strict validation |
| Logging | Verbose (all requests) | Moderate (errors + slow) | Minimal (errors only) |
| Compression | Disabled (readability) | Enabled | Enabled |

**Analysis**: Columns are coherent families per environment → **Abstract Factory**

**TypeScript Implementation**:

```typescript
type Middleware = (req: Request, next: () => Promise<Response>) => Promise<Response>;

interface EnvironmentMiddlewareFactory {
  createErrorHandler(): Middleware;
  createAuthMiddleware(): Middleware;
  createLoggingMiddleware(): Middleware;
  createCompressionMiddleware(): Middleware;
}

class DevelopmentMiddlewareFactory implements EnvironmentMiddlewareFactory {
  createErrorHandler(): Middleware {
    return async (req, next) => {
      try {
        return await next();
      } catch (error) {
        // Development: detailed exceptions
        return new Response(String(error), { status: 500 });
      }
    };
  }

  createAuthMiddleware(): Middleware {
    return async (req, next) => {
      // Development: relaxed validation
      return next();
    };
  }

  // ... other middleware
}

// Server configuration
function configureMiddleware(env: string): EnvironmentMiddlewareFactory {
  switch (env) {
    case "development": return new DevelopmentMiddlewareFactory();
    case "staging": return new StagingMiddlewareFactory();
    default: return new ProductionMiddlewareFactory();
  }
}

const factory = configureMiddleware(process.env.NODE_ENV ?? "production");
```

---

## Example 3: Dependency Injection Lifetime Scopes (Strategy)

### CVA Matrix

| Operation | Transient | Scoped | Singleton |
|-----------|-----------|--------|-----------|
| Create instance | New every request | New per scope | Once per app lifetime |
| Dispose | Immediately after use | End of scope | App shutdown |
| Resolve dependencies | Fresh dependencies | Cached within scope | Cached globally |
| Thread safety | Not required (new each time) | Scope-local only | Must be thread-safe |

**Analysis**: Rows vary independently (each operation has different strategy per lifetime) → **Strategy pattern**

**TypeScript Implementation**:

```typescript
// Strategy interface
interface LifetimeStrategy<T> {
  createInstance(factory: () => T): T;
  dispose(instance: T): void;
  resolve(key: string, factory: () => T): T;
}

// Concrete strategy: Transient
class TransientLifetimeStrategy<T> implements LifetimeStrategy<T> {
  createInstance(factory: () => T): T {
    return factory(); // New every time
  }

  dispose(instance: T): void {
    // Dispose immediately (if instance has cleanup)
  }

  resolve(key: string, factory: () => T): T {
    return factory(); // Fresh
  }
}

// Concrete strategy: Scoped
class ScopedLifetimeStrategy<T> implements LifetimeStrategy<T> {
  private readonly scopeCache = new Map<string, T>();

  createInstance(factory: () => T): T {
    return factory();
  }

  dispose(instance: T): void {
    // Defer until scope ends
  }

  endScope(): void {
    this.scopeCache.clear();
  }

  resolve(key: string, factory: () => T): T {
    const cached = this.scopeCache.get(key);
    if (cached) return cached; // Cached within scope
    const instance = factory();
    this.scopeCache.set(key, instance);
    return instance;
  }
}

// Concrete strategy: Singleton
class SingletonLifetimeStrategy<T> implements LifetimeStrategy<T> {
  private static readonly instances = new Map<string, unknown>();

  createInstance(factory: () => T): T {
    return factory();
  }

  dispose(instance: T): void {
    // Never dispose (app lifetime)
  }

  resolve(key: string, factory: () => T): T {
    const cached = SingletonLifetimeStrategy.instances.get(key);
    if (cached) return cached as T; // Globally cached
    const instance = factory();
    SingletonLifetimeStrategy.instances.set(key, instance);
    return instance;
  }
}

// Usage
type ServiceLifetime = "transient" | "scoped" | "singleton";

interface ServiceDescriptor<T> {
  key: string;
  factory: () => T;
  lifetime: LifetimeStrategy<T>;
}

function createServiceDescriptor<T>(
  key: string,
  factory: () => T,
  lifetime: ServiceLifetime,
): ServiceDescriptor<T> {
  const strategy: LifetimeStrategy<T> = (() => {
    switch (lifetime) {
      case "transient": return new TransientLifetimeStrategy<T>();
      case "scoped": return new ScopedLifetimeStrategy<T>();
      case "singleton": return new SingletonLifetimeStrategy<T>();
    }
  })();

  return { key, factory, lifetime: strategy };
}
```

---

## When NOT to Abstract (YAGNI Examples)

### Example: Single Payment Method (No Variability)

**Matrix**:

| Commonality | Credit Card |
|-------------|-------------|
| Validate    | Card limit  |
| Authorize   | Issuer API  |
| Record      | CardDB      |
| Handle      | Decline codes |

**Analysis**: Only 1 column (no variability to abstract over)

**Decision**: **Don't abstract**. Wait for 2nd payment method per YAGNI.

**Implementation**: Concrete class, no interfaces

```typescript
class CreditCardPaymentProcessor {
  async process(request: PaymentRequest): Promise<PaymentResult> {
    // Concrete implementation
    // No abstraction overhead
  }
}
```

**ADR Stub**:

```
# ADR-XXX: No Abstraction for Payment Processing

## Context
Only 1 payment method (Credit Card) currently supported.

## Decision
Use concrete `CreditCardPaymentProcessor` class. No abstraction.

## Rationale
- CVA matrix shows no variability (1 column)
- YAGNI: Don't abstract until 2+ payment methods exist
- Premature abstraction worse than no abstraction (CLAUDE.md)

## Reassessment Trigger
When 2nd payment method (PayPal, Bank Transfer) is added, re-run CVA and abstract.
```

---

## Edge Case: All Variability (Reconsider Scope)

**Matrix**:

| Commonality | Use Case 1 | Use Case 2 | Use Case 3 |
|-------------|------------|------------|------------|
| Workflow    | A → B → C  | X → Y → Z  | M → N → O  |
| Data        | Type1      | Type2      | Type3      |
| Output      | Format1    | Format2    | Format3    |

**Analysis**: Every cell different (no commonality)

**Decision**: **Reconsider scope**. Use cases may be unrelated. Analyze separately or narrow scope.

---

## Reassessment Triggers

Re-run CVA when:

1. **3+ new use cases** added
2. **Major architectural shift** (monolith → microservices)
3. **Performance issues** (abstraction overhead not justified)
4. **Team feedback** (abstraction too complex or not pulling weight)
5. **Quarterly review** (align with retrospective cycle)

---

## Further Reading

- **Pattern Mapping Guide**: `pattern-mapping-guide.md`
