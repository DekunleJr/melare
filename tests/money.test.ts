import { describe, expect, it } from "vitest";
import {
  deliversTo,
  deliveryPrice,
  depositDue,
  discountProblem,
  discountSplit,
  variantLabel,
  variantPrice,
  type Discount,
} from "@/features/pricing";
import { formatPence, parsePounds, penceToInput } from "@/lib/money";
import { matchPostcode, normalisePostcode, parseDistrictList } from "@/lib/postcode";
import { safeNext } from "@/lib/redirects";
import { parseBlocks } from "@/lib/richtext";

describe("money", () => {
  it("parses pounds into exact pence", () => {
    expect(parsePounds("12")).toBe(1200);
    expect(parsePounds("12.5")).toBe(1250);
    expect(parsePounds("£1,200.99")).toBe(120099);
    expect(parsePounds("19.99")).toBe(1999);
  });

  it("rejects anything that is not an amount", () => {
    for (const bad of ["", "-1", "1.999", "abc", "1e5"]) expect(parsePounds(bad)).toBeNull();
  });

  it("formats amounts", () => {
    expect(formatPence(120099)).toBe("£1,200.99");
    expect(penceToInput(500)).toBe("5.00");
  });
});

describe("products", () => {
  it("uses a sale price only when it is lower", () => {
    expect(variantPrice({ pricePence: 1000, salePricePence: 800 })).toBe(800);
    expect(variantPrice({ pricePence: 1000, salePricePence: 0 })).toBe(1000);
    expect(variantPrice({ pricePence: 1000, salePricePence: 1200 })).toBe(1000);
  });

  it("names an option from the parts that are set", () => {
    expect(variantLabel({ colour: "Black", length: "26 inch", texture: "", size: "" })).toBe(
      "Black / 26 inch",
    );
  });
});

describe("delivery", () => {
  const method = {
    id: 1,
    name: "Standard",
    description: "",
    pricePence: 495,
    freeOverPence: 5000,
    postcodes: "",
  };

  it("is free from the threshold", () => {
    expect(deliveryPrice(method, 4999)).toBe(495);
    expect(deliveryPrice(method, 5000)).toBe(0);
    expect(deliveryPrice({ ...method, freeOverPence: 0 }, 99999)).toBe(495);
  });

  it("can be limited to postcodes", () => {
    expect(deliversTo(method, "SW1A 1AA")).toBe(true);
    expect(deliversTo({ postcodes: "M,SK1" }, "M14 5AB")).toBe(true);
    expect(deliversTo({ postcodes: "M,SK1" }, "SK12 1AA")).toBe(false);
  });
});

describe("postcodes", () => {
  it("normalises full UK postcodes", () => {
    expect(normalisePostcode(" m145ab ")).toBe("M14 5AB");
    expect(normalisePostcode("EC1A 1BB")).toBe("EC1A 1BB");
    expect(normalisePostcode("M14")).toBeNull();
  });

  it("prefers a district over a whole area and never confuses M1 with M14", () => {
    const areas = ["M", "M14"];
    const find = (p: string) => matchPostcode(areas, (a) => a, p);
    expect(find("M14 5AB")).toBe("M14");
    expect(find("M1 1AA")).toBe("M");
    expect(matchPostcode(["M1"], (a) => a, "M14 5AB")).toBeNull();
  });

  it("reads a typed list", () => {
    expect(parseDistrictList("m1, M14  xx9z nonsense")).toEqual({
      valid: ["M1", "M14", "XX9Z"],
      invalid: ["nonsense"],
    });
  });
});

describe("deposits", () => {
  const service = {
    paymentMode: "deposit" as const,
    depositType: "fixed" as const,
    depositPence: 2000,
    depositPercent: 30,
  };

  it("handles each payment setting", () => {
    expect(depositDue({ ...service, paymentMode: "pay_at_salon" }, 10000)).toBe(0);
    expect(depositDue({ ...service, paymentMode: "full" }, 10000)).toBe(10000);
    expect(depositDue(service, 10000)).toBe(2000);
    expect(depositDue({ ...service, depositType: "percent" }, 10000)).toBe(3000);
    expect(depositDue({ ...service, depositType: "percent" }, 999)).toBe(300);
  });

  it("never asks for more than the total", () => {
    expect(depositDue(service, 1500)).toBe(1500);
  });
});

describe("discount codes", () => {
  const code: Discount = {
    code: "TEN",
    type: "percent",
    value: 10,
    appliesTo: "all",
    minSpendPence: 0,
    startsAt: null,
    endsAt: null,
    maxUses: 0,
    usedCount: 0,
    active: true,
  };
  const totals = { productsPence: 3000, servicesPence: 10000 };

  it("splits a percentage across both parts", () => {
    expect(discountSplit(code, totals)).toEqual({ products: 300, services: 1000 });
    expect(discountSplit({ ...code, appliesTo: "services" }, totals)).toEqual({
      products: 0,
      services: 1000,
    });
  });

  it("takes a fixed amount off products first and never below zero", () => {
    const fixed = { ...code, type: "fixed" as const, value: 4000 };
    expect(discountSplit(fixed, totals)).toEqual({ products: 3000, services: 1000 });
    expect(discountSplit({ ...fixed, value: 99999 }, totals)).toEqual({
      products: 3000,
      services: 10000,
    });
  });

  it("explains why a code cannot be used", () => {
    const now = new Date("2027-01-10T12:00:00Z");
    expect(discountProblem(code, totals, now)).toBeNull();
    expect(discountProblem({ ...code, active: false }, totals, now)).toMatch(/not valid/);
    expect(discountProblem({ ...code, endsAt: new Date("2027-01-01") }, totals, now)).toMatch(/expired/);
    expect(discountProblem({ ...code, maxUses: 2, usedCount: 2 }, totals, now)).toMatch(/fully used/);
    expect(discountProblem({ ...code, minSpendPence: 20000 }, totals, now)).toMatch(/Spend/);
    expect(
      discountProblem({ ...code, appliesTo: "products" }, { productsPence: 0, servicesPence: 1 }, now),
    ).toMatch(/products only/);
  });
});

describe("safeNext", () => {
  it("allows only same-site paths", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/\t/x", ""]) {
      expect(safeNext(bad)).toBe("/account");
    }
  });
});

describe("page formatting", () => {
  it("separates headings, lists and paragraphs", () => {
    expect(parseBlocks("## Title\nText\n\n- a\n- b").map((b) => b.type)).toEqual(["h2", "p", "ul"]);
  });
});
