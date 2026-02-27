---
layout: doc
title: TypeScript 高级类型
category: 前端开发
date: 2024-12-10
tags: [TypeScript, JavaScript]
---

# TypeScript 高级类型

TypeScript 提供了强大的类型系统，本文介绍一些高级类型特性。

## 联合类型（Union Types）

联合类型表示一个值可以是几种类型之一。

```typescript
type StringOrNumber = string | number;

function printId(id: StringOrNumber) {
  console.log("ID is: " + id);
}

printId(101);        // OK
printId("202");      // OK
```

## 交叉类型（Intersection Types）

交叉类型将多个类型合并为一个类型。

```typescript
interface Person {
  name: string;
}

interface Employee {
  employeeId: number;
}

type Staff = Person & Employee;

const staff: Staff = {
  name: "张三",
  employeeId: 123
};
```

## 类型守卫（Type Guards）

类型守卫用于在运行时检查类型。

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function processValue(value: string | number) {
  if (isString(value)) {
    // 这里 value 被推断为 string
    console.log(value.toUpperCase());
  } else {
    // 这里 value 被推断为 number
    console.log(value.toFixed(2));
  }
}
```

## 泛型（Generics）

泛型提供了创建可重用组件的方法。

```typescript
function identity<T>(arg: T): T {
  return arg;
}

let output1 = identity<string>("myString");
let output2 = identity<number>(100);
```

## 映射类型（Mapped Types）

映射类型可以从旧类型创建新类型。

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

interface User {
  name: string;
  age: number;
}

type ReadonlyUser = Readonly<User>;
// 结果：{ readonly name: string; readonly age: number; }
```

## 条件类型（Conditional Types）

条件类型根据条件选择两个类型之一。

```typescript
type NonNullable<T> = T extends null | undefined ? never : T;

type A = NonNullable<string | null>;  // string
type B = NonNullable<number | undefined>;  // number
```

## 实用工具类型

TypeScript 提供了许多内置的实用工具类型：

```typescript
// Partial - 所有属性变为可选
type PartialUser = Partial<User>;

// Required - 所有属性变为必需
type RequiredUser = Required<User>;

// Pick - 选择部分属性
type UserName = Pick<User, 'name'>;

// Omit - 排除部分属性
type UserWithoutAge = Omit<User, 'age'>;

// Record - 创建对象类型
type PageInfo = Record<string, { title: string }>;
```

## 总结

掌握 TypeScript 高级类型能够帮助我们编写更安全、更灵活的代码。
