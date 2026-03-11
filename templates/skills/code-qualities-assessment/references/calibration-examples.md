# Calibration Examples

Reference examples for consistent code quality scoring across teams.

## Cohesion Examples

### Score: 10/10 (Perfect Cohesion)

```typescript
// Single responsibility: validate email addresses
class EmailValidator {
  validate(email: string): boolean {
    return this.hasValidFormat(email) && this.hasValidDomain(email);
  }

  private hasValidFormat(email: string): boolean {
    return email.includes("@") && email.split("@")[1].includes(".");
  }

  private hasValidDomain(email: string): boolean {
    const domain = email.split("@")[1];
    return domain.length > 3;
  }
}
```

**Why 10**: Every method serves email validation. All methods use same data. Clear single purpose.

### Score: 7/10 (Good Cohesion)

```typescript
// Represents a user with validation
class User {
  readonly createdAt: Date;

  constructor(
    public email: string,
    public name: string,
  ) {
    this.createdAt = new Date();  // Minor supporting concern
  }

  validate(): boolean {
    return this.validateEmail() && this.validateName();
  }

  private validateEmail(): boolean {
    return this.email.includes("@");
  }

  private validateName(): boolean {
    return this.name.length > 0;
  }
}
```

**Why 7**: Primary responsibility (user data) is clear. Validation is closely related. Timestamp is minor but justified.

### Score: 4/10 (Weak Cohesion)

```typescript
// Mixed responsibilities
class UserManager {
  createUser(email: string): User {
    return new User(email);
  }

  sendEmail(to: string, subject: string): void {
    // Email sending logic
  }

  logActivity(message: string): void {
    // Logging logic
  }
}
```

**Why 4**: Three unrelated responsibilities (user creation, email, logging). Name is vague ("Manager").

### Score: 1/10 (No Cohesion)

```typescript
// God object with random utilities
class Utilities {
  formatDate(date: Date): string {
    return "";
  }

  calculateTax(amount: number): number {
    return 0;
  }

  sendSms(phone: string, message: string): void {}

  hashPassword(password: string): string {
    return "";
  }
}
```

**Why 1**: Completely unrelated functions. Impossible to describe in one sentence.

---

## Coupling Examples

### Score: 10/10 (Minimal Coupling)

```typescript
class OrderProcessor {
  constructor(private paymentService: PaymentServiceInterface) {}  // Injected dependency

  process(order: Order): boolean {
    return this.paymentService.charge(order.total);
  }
}
```

**Why 10**: Depends on interface, not implementation. Easy to test with mocks. No global state.

### Score: 7/10 (Loose Coupling)

```typescript
class OrderProcessor {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();  // Direct instantiation
  }

  process(order: Order): boolean {
    return this.paymentService.charge(order.total);
  }
}
```

**Why 7**: Direct instantiation creates coupling, but isolated to constructor. Still testable.

### Score: 4/10 (Moderate Coupling)

```typescript
class OrderProcessor {
  process(order: Order): boolean {
    // Global singleton access
    const payment = PaymentService.getInstance();
    const logger = Logger.getInstance();

    logger.info("Processing order");
    return payment.charge(order.total);
  }
}
```

**Why 4**: Depends on singletons (hidden dependencies). Global state. Hard to test.

### Score: 1/10 (Tight Coupling)

```typescript
class OrderProcessor {
  process(order: Order): boolean {
    // Hard-coded dependencies everywhere
    const db = new DatabaseConnection("localhost", 5432);
    const payment = new StripePayment({ apiKey: "sk_live_..." });
    const email = new SmtpEmail("smtp.gmail.com");

    db.save(order);
    payment.charge(order.total);
    email.send(order.user.email, "Order confirmed");
    return true;
  }
}
```

**Why 1**: Hard-coded connections. Impossible to test without real Stripe, SMTP, DB.

---

## Encapsulation Examples

### Score: 10/10 (Perfect Encapsulation)

```typescript
class BankAccount {
  #balance: number;  // Private field

  constructor(initialBalance: number) {
    this.#balance = initialBalance;
  }

  deposit(amount: number): void {
    if (amount > 0) {
      this.#balance += amount;
    }
  }

  get balance(): number {
    return this.#balance;  // Returns value, not reference
  }
}
```

**Why 10**: All internals private. Minimal public API. Balance cannot be modified directly.

### Score: 7/10 (Good Encapsulation)

```typescript
class BankAccount {
  private _balance: number;  // Private (TypeScript keyword)

  constructor(initialBalance: number) {
    this._balance = initialBalance;
  }

  deposit(amount: number): void {
    this._balance += amount;
  }

  get balance(): number {
    return this._balance;
  }
}
```

**Why 7**: Uses getter for controlled access. Balance is private with accessor. Good enough for most cases.

### Score: 4/10 (Weak Encapsulation)

```typescript
class BankAccount {
  balance: number;  // Public field
  transactions: number[] = [];  // Public mutable array

  constructor(initialBalance: number) {
    this.balance = initialBalance;
  }

  deposit(amount: number): void {
    this.balance += amount;
    this.transactions.push(amount);
  }
}
```

**Why 4**: Public fields allow direct modification. Mutable list can be modified externally.

### Score: 1/10 (No Encapsulation)

```typescript
class BankAccount {
  static balance = 0;  // Static variable (shared)
  static transactions: number[] = [];  // Shared mutable array

  constructor(initialBalance: number) {
    BankAccount.balance = initialBalance;
  }
}
```

**Why 1**: Everything is public and shared. Massive coupling. Bugs guaranteed.

---

## Testability Examples

### Score: 10/10 (Perfect Testability)

```typescript
// Pure function - no side effects, deterministic
function calculateDiscount(price: number, discountRate: number): number {
  return price * (1 - discountRate);
}

// Test
expect(calculateDiscount(100, 0.2)).toBe(80);
```

**Why 10**: Pure function. No dependencies. No side effects. Trivial to test.

### Score: 7/10 (Good Testability)

```typescript
class DiscountCalculator {
  constructor(private taxRate: number) {}

  calculateFinalPrice(price: number, discount: number): number {
    const discounted = price * (1 - discount);
    return discounted * (1 + this.taxRate);
  }
}

// Test
const calc = new DiscountCalculator(0.1);
expect(calc.calculateFinalPrice(100, 0.2)).toBe(88);
```

**Why 7**: Deterministic. Dependencies injected. Easy to set up tests.

### Score: 4/10 (Moderate Testability)

```typescript
class DiscountCalculator {
  calculateFinalPrice(price: number, discount: number): number {
    const taxRate = this.getTaxRateFromDb();  // Database call
    const discounted = price * (1 - discount);
    return discounted * (1 + taxRate);
  }

  private getTaxRateFromDb(): number {
    // Database query
    return 0;
  }
}

// Test requires mocking database
```

**Why 4**: Requires mocking. Not deterministic. Setup is complex.

### Score: 1/10 (Hard to Test)

```typescript
let CURRENT_TAX_RATE = 0.1;

class DiscountCalculator {
  calculateFinalPrice(price: number): number {
    // Non-deterministic
    const randomDiscount = Math.random();

    // Global state
    const taxRate = CURRENT_TAX_RATE;

    // Time-dependent
    const extraDiscount = new Date().getHours() < 12 ? 0.1 : 0;

    return price * (1 - randomDiscount - extraDiscount) * (1 + taxRate);
  }
}
```

**Why 1**: Non-deterministic (random). Global state. Time-dependent. Untestable without full integration.

---

## Non-Redundancy Examples

### Score: 10/10 (Zero Duplication)

```typescript
function calculateTax(amount: number, rate: number): number {
  return amount * rate;
}

function calculateOrderTotal(subtotal: number, taxRate: number): number {
  return subtotal + calculateTax(subtotal, taxRate);
}

function calculateInvoiceTotal(subtotal: number, taxRate: number): number {
  return subtotal + calculateTax(subtotal, taxRate);
}
```

**Why 10**: Tax calculation abstracted. Reused in both functions. Single source of truth.

### Score: 7/10 (Minimal Duplication)

```typescript
function calculateOrderTotal(subtotal: number, taxRate: number): number {
  const tax = subtotal * taxRate;
  return subtotal + tax;
}

function calculateInvoiceTotal(subtotal: number, taxRate: number, discount: number): number {
  const discounted = subtotal * (1 - discount);
  const tax = discounted * taxRate;  // Intentional duplication for clarity
  return discounted + tax;
}
```

**Why 7**: Minor duplication of tax calculation. Justified by different contexts.

### Score: 4/10 (Moderate Duplication)

```typescript
function processOrder(subtotal: number, taxRate: number): number {
  const tax = subtotal * taxRate;
  const shipping = 10.0;
  const total = subtotal + tax + shipping;
  console.log(`Order: $${total.toFixed(2)}`);
  return total;
}

function processInvoice(subtotal: number, taxRate: number): number {
  const tax = subtotal * taxRate;  // Duplicated
  const shipping = 10.0;  // Duplicated
  const total = subtotal + tax + shipping;  // Duplicated
  console.log(`Invoice: $${total.toFixed(2)}`);  // Similar
  return total;
}
```

**Why 4**: Significant duplication. Missed abstraction opportunity.

### Score: 1/10 (Pervasive Duplication)

```typescript
function processOrder(subtotal: number, taxRate: number): number {
  let tax = subtotal * taxRate;
  const shipping = 10.0;
  const handling = 5.0;
  let total = subtotal + tax + shipping + handling;
  if (total > 100) {
    total *= 0.9;
  }
  console.log(`Order total: $${total.toFixed(2)}`);
  return total;
}

function processInvoice(subtotal: number, taxRate: number): number {
  let tax = subtotal * taxRate;
  const shipping = 10.0;
  const handling = 5.0;
  let total = subtotal + tax + shipping + handling;
  if (total > 100) {
    total *= 0.9;
  }
  console.log(`Invoice total: $${total.toFixed(2)}`);
  return total;
}

function processQuote(subtotal: number, taxRate: number): number {
  let tax = subtotal * taxRate;
  const shipping = 10.0;
  const handling = 5.0;
  let total = subtotal + tax + shipping + handling;
  if (total > 100) {
    total *= 0.9;
  }
  console.log(`Quote total: $${total.toFixed(2)}`);
  return total;
}
```

**Why 1**: Copy-paste everywhere. Fixing bugs requires updating 3 places. Nightmare.

---

## TypeScript-Specific Patterns

### Interface Segregation

```typescript
// Good coupling (10/10)
interface PaymentProcessor {
  charge(amount: number): Promise<boolean>;
}

class Order {
  constructor(private payment: PaymentProcessor) {}
}

// Poor coupling (4/10)
class Order {
  constructor(private payment: StripePayment) {}  // Concrete dependency
}
```

### Encapsulation with Access Modifiers

```typescript
// Perfect encapsulation (10/10) - uses ES private fields
class BankAccount {
  #balance: number;

  constructor(initialBalance: number) {
    this.#balance = initialBalance;
  }

  get balance(): number {
    return this.#balance;  // Read-only accessor
  }

  deposit(amount: number): void {
    this.#balance += amount;
  }
}

// Weak encapsulation (4/10) - public mutable property
class BankAccount {
  balance: number = 0;  // Public, directly modifiable
}
```

### Readonly and Immutability

```typescript
// Good non-redundancy (9/10) - readonly prevents accidental mutation
interface Config {
  readonly host: string;
  readonly port: number;
}

// Poor (3/10) - mutable config invites inconsistency
interface Config {
  host: string;
  port: number;
}
```

---

## Calibration Workshop

Use these examples in team calibration sessions:

1. **Round 1**: Score examples independently
2. **Round 2**: Compare scores, discuss differences
3. **Round 3**: Reach consensus on borderline cases
4. **Round 4**: Create team-specific examples

**Goal**: 80%+ agreement on scores within ±1 point.
