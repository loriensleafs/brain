# Refactoring Patterns for Code Quality

Remediation patterns for low quality scores.

## Low Cohesion → Extract Class

**Pattern**: When a class has multiple unrelated responsibilities, split it.

### Before (Score: 4/10)

```typescript
class UserManager {
  createUser(email: string): User {
    const user = new User(email);
    this.saveToDatabase(user);
    return user;
  }

  sendWelcomeEmail(user: User): void {
    // Email logic
  }

  logActivity(message: string): void {
    // Logging logic
  }

  private saveToDatabase(user: User): void {
    // Database logic
  }
}
```

### After (Score: 9/10)

```typescript
// Single responsibility: user persistence
class UserRepository {
  save(user: User): void {
    // Database logic
  }
}

// Single responsibility: email sending
class EmailService {
  sendWelcome(user: User): void {
    // Email logic
  }
}

// Single responsibility: logging
class ActivityLogger {
  log(message: string): void {
    // Logging logic
  }
}

// Orchestrates user creation (sergeant method)
class UserService {
  constructor(
    private repo: UserRepository,
    private email: EmailService,
    private logger: ActivityLogger,
  ) {}

  createUser(emailAddress: string): User {
    const user = new User(emailAddress);
    this.repo.save(user);
    this.email.sendWelcome(user);
    this.logger.log(`Created user: ${emailAddress}`);
    return user;
  }
}
```

**Quality improvement**:

- Cohesion: 4 → 9 (each class has single responsibility)
- Testability: 4 → 9 (easy to mock dependencies)
- Coupling: 5 → 8 (dependencies injected)

---

## High Coupling → Dependency Injection

**Pattern**: Replace hard-coded dependencies with injected abstractions.

### Before (Score: 3/10)

```typescript
class OrderProcessor {
  process(order: Order): boolean {
    // Hard-coded dependencies
    const payment = new StripePayment({ apiKey: "sk_live_..." });
    const email = new SmtpEmail("smtp.gmail.com");

    if (payment.charge(order.total)) {
      email.send(order.user.email, "Order confirmed");
      return true;
    }
    return false;
  }
}
```

### After (Score: 9/10)

```typescript
interface PaymentProcessor {
  charge(amount: number): boolean;
}

interface EmailSender {
  send(to: string, subject: string): void;
}

class OrderProcessor {
  constructor(
    private payment: PaymentProcessor,
    private email: EmailSender,
  ) {}

  process(order: Order): boolean {
    if (this.payment.charge(order.total)) {
      this.email.send(order.user.email, "Order confirmed");
      return true;
    }
    return false;
  }
}

// Easy to test with mocks
const mockPayment: PaymentProcessor = {
  charge: (_amount: number) => true,
};

const processor = new OrderProcessor(mockPayment, mockEmail);
```

**Quality improvement**:

- Coupling: 3 → 9 (depends on abstractions)
- Testability: 2 → 10 (trivial to mock)

---

## Poor Encapsulation → Facade Pattern

**Pattern**: Hide complex internals behind a simple interface.

### Before (Score: 4/10)

```typescript
class PaymentSystem {
  // Too many public methods exposing internals
  validateCard(card: Card): boolean { return true; }
  checkFraud(transaction: Transaction): boolean { return true; }
  callGateway(data: Record<string, unknown>): Response { return new Response(); }
  saveTransaction(transaction: Transaction): void {}
  sendReceipt(email: string, transaction: Transaction): void {}
}
```

### After (Score: 9/10)

```typescript
class PaymentSystem {
  // Simple public API - internals are private
  charge(card: Card, amount: number, email: string): boolean {
    if (!this.validateCard(card)) {
      return false;
    }

    const transaction = this.createTransaction(card, amount);

    if (!this.checkFraud(transaction)) {
      return false;
    }

    if (this.callGateway(transaction)) {
      this.saveTransaction(transaction);
      this.sendReceipt(email, transaction);
      return true;
    }

    return false;
  }

  // All implementation details are private
  private validateCard(card: Card): boolean { return true; }
  private checkFraud(transaction: Transaction): boolean { return true; }
  private createTransaction(card: Card, amount: number): Transaction { return {} as Transaction; }
  private callGateway(transaction: Transaction): boolean { return true; }
  private saveTransaction(transaction: Transaction): void {}
  private sendReceipt(email: string, transaction: Transaction): void {}
}
```

**Quality improvement**:

- Encapsulation: 4 → 9 (1 public method, internals hidden)
- Cohesion: 6 → 8 (clear orchestration)

---

## Low Testability → Dependency Inversion

**Pattern**: Invert dependencies to make code testable.

### Before (Score: 2/10)

```typescript
let TAX_RATE = 0.1;

class DiscountCalculator {
  calculate(price: number): number {
    // Non-deterministic
    const randomFactor = Math.random();

    // Global state
    const taxRate = TAX_RATE;

    // Time-dependent
    if (new Date().getHours() < 12) {
      return price * 0.9 * randomFactor * (1 + taxRate);
    }
    return price * randomFactor * (1 + taxRate);
  }
}
```

### After (Score: 9/10)

```typescript
interface RandomGenerator {
  generate(): number;
}

interface TimeProvider {
  currentHour(): number;
}

interface TaxRateProvider {
  getRate(): number;
}

class DiscountCalculator {
  constructor(
    private random: RandomGenerator,
    private time: TimeProvider,
    private tax: TaxRateProvider,
  ) {}

  calculate(price: number): number {
    const randomFactor = this.random.generate();
    const taxRate = this.tax.getRate();

    if (this.time.currentHour() < 12) {
      return price * 0.9 * randomFactor * (1 + taxRate);
    }
    return price * randomFactor * (1 + taxRate);
  }
}

// Now testable!
const fixedRandom: RandomGenerator = { generate: () => 0.5 };
const fixedTime: TimeProvider = { currentHour: () => 10 };
const fixedTax: TaxRateProvider = { getRate: () => 0.1 };

const calc = new DiscountCalculator(fixedRandom, fixedTime, fixedTax);
expect(calc.calculate(100)).toBe(49.5);  // Deterministic!
```

**Quality improvement**:

- Testability: 2 → 9 (fully deterministic)
- Coupling: 4 → 8 (dependencies injected)

---

## High Duplication → Extract Function

**Pattern**: Replace copy-pasted code with shared abstraction.

### Before (Score: 2/10)

```typescript
function calculateOrderTotal(subtotal: number, taxRate: number): number {
  const tax = subtotal * taxRate;
  const shipping = 10.0;
  const handling = 5.0;
  let total = subtotal + tax + shipping + handling;
  if (total > 100) {
    total *= 0.9;
  }
  return total;
}

function calculateInvoiceTotal(subtotal: number, taxRate: number): number {
  const tax = subtotal * taxRate;  // Duplicated
  const shipping = 10.0;  // Duplicated
  const handling = 5.0;  // Duplicated
  let total = subtotal + tax + shipping + handling;  // Duplicated
  if (total > 100) {  // Duplicated
    total *= 0.9;  // Duplicated
  }
  return total;
}

function calculateQuoteTotal(subtotal: number, taxRate: number): number {
  const tax = subtotal * taxRate;  // Duplicated
  const shipping = 10.0;  // Duplicated
  const handling = 5.0;  // Duplicated
  let total = subtotal + tax + shipping + handling;  // Duplicated
  if (total > 100) {  // Duplicated
    total *= 0.9;  // Duplicated
  }
  return total;
}
```

### After (Score: 10/10)

```typescript
const SHIPPING_FEE = 10.0;
const HANDLING_FEE = 5.0;
const BULK_DISCOUNT_THRESHOLD = 100.0;
const BULK_DISCOUNT_RATE = 0.9;

// Single source of truth for total calculation
function calculateTotal(subtotal: number, taxRate: number): number {
  const tax = subtotal * taxRate;
  let total = subtotal + tax + SHIPPING_FEE + HANDLING_FEE;

  if (total > BULK_DISCOUNT_THRESHOLD) {
    total *= BULK_DISCOUNT_RATE;
  }

  return total;
}

function calculateOrderTotal(subtotal: number, taxRate: number): number {
  return calculateTotal(subtotal, taxRate);
}

function calculateInvoiceTotal(subtotal: number, taxRate: number): number {
  return calculateTotal(subtotal, taxRate);
}

function calculateQuoteTotal(subtotal: number, taxRate: number): number {
  return calculateTotal(subtotal, taxRate);
}
```

**Quality improvement**:

- Non-redundancy: 2 → 10 (zero duplication)
- Testability: 6 → 9 (test once, applies everywhere)

---

## Programming by Intention Pattern

**Sergeant methods** direct **private methods**.

### Before (Mixed Abstraction Levels)

```typescript
function processOrder(order: Order): boolean {
  // Low-level details mixed with high-level orchestration
  if (!order.email || !order.email.includes("@")) {
    return false;
  }

  const db = new Database("host=localhost dbname=orders");
  db.execute("INSERT INTO orders VALUES ($1, $2)", [order.id, order.total]);
  db.close();

  const smtp = new SmtpClient("smtp.gmail.com");
  smtp.sendMail("noreply@example.com", order.email, "Order confirmed");
  smtp.quit();

  return true;
}
```

### After (Sergeant + Privates)

```typescript
class OrderService {
  // Sergeant method: high-level orchestration
  processOrder(order: Order): boolean {
    if (!this.isValidOrder(order)) {
      return false;
    }

    this.saveOrder(order);
    this.sendConfirmation(order);
    return true;
  }

  // Private: focused validation logic
  private isValidOrder(order: Order): boolean {
    return !!order.email && order.email.includes("@");
  }

  // Private: focused persistence logic
  private saveOrder(order: Order): void {
    const db = this.getDbConnection();
    db.execute("INSERT INTO orders VALUES ($1, $2)", [order.id, order.total]);
    db.close();
  }

  // Private: focused email logic
  private sendConfirmation(order: Order): void {
    const smtp = this.getSmtpConnection();
    smtp.sendMail("noreply@example.com", order.email, "Order confirmed");
    smtp.quit();
  }
}
```

**Quality improvement**:

- Cohesion: 5 → 9 (each method has single focus)
- Testability: 4 → 8 (can test parts separately)
- Readability: Massively improved

---

## Quick Reference

| Low Score In | Use Pattern | Improvement |
|--------------|-------------|-------------|
| Cohesion | Extract Class | Split responsibilities |
| Coupling | Dependency Injection | Inject abstractions |
| Encapsulation | Facade | Hide internals |
| Testability | Dependency Inversion | Make deterministic |
| Non-redundancy | Extract Function | Share common code |

---

## Related Resources

- Fowler's Refactoring Catalog: <https://refactoring.com/catalog/>
- Martin's Clean Code: SOLID principles
- Evans' DDD: Bounded contexts, aggregates
