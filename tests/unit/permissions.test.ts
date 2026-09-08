import { describe, expect, it } from "vitest";

import {
  assertSchoolRole,
  canWriteInSchool,
  ForbiddenError,
  hasSchoolRole,
  isSchoolAdmin,
  isSchoolMember,
  isSchoolStaff,
  type MembershipLike,
  perspectivesFor,
  resolvePerspective,
  schoolIdsFor,
} from "@/lib/permissions";

const NEUILLY = "school-neuilly";
const LEVALLOIS = "school-levallois";

const parent: MembershipLike = { schoolId: NEUILLY, role: "parent", status: "active" };
const guardian: MembershipLike = { schoolId: NEUILLY, role: "guardian", status: "active" };
const teacher: MembershipLike = { schoolId: NEUILLY, role: "teacher", status: "active" };
const staff: MembershipLike = { schoolId: NEUILLY, role: "staff", status: "active" };
const admin: MembershipLike = { schoolId: NEUILLY, role: "school_admin", status: "active" };
const superAdmin: MembershipLike = { schoolId: NEUILLY, role: "super_admin", status: "active" };
const invitedParent: MembershipLike = { schoolId: NEUILLY, role: "parent", status: "invited" };

describe("school roles", () => {
  it("ignores memberships that are not active", () => {
    expect(isSchoolMember([invitedParent], NEUILLY)).toBe(false);
    expect(hasSchoolRole([invitedParent], NEUILLY, ["parent"])).toBe(false);
  });

  it("scopes roles to a school", () => {
    expect(isSchoolStaff([staff], NEUILLY)).toBe(true);
    expect(isSchoolStaff([staff], LEVALLOIS)).toBe(false);
    expect(isSchoolAdmin([staff], NEUILLY)).toBe(false);
    expect(isSchoolAdmin([admin], NEUILLY)).toBe(true);
  });

  it("lets the super admin through everywhere", () => {
    expect(isSchoolAdmin([superAdmin], LEVALLOIS)).toBe(true);
    expect(isSchoolMember([superAdmin], LEVALLOIS)).toBe(true);
  });

  it("keeps guardians read-only", () => {
    expect(canWriteInSchool([guardian], NEUILLY)).toBe(false);
    expect(canWriteInSchool([parent], NEUILLY)).toBe(true);
    expect(canWriteInSchool([teacher], NEUILLY)).toBe(true);
  });

  it("lists the schools of a user once", () => {
    expect(
      schoolIdsFor([parent, teacher, { ...parent, schoolId: LEVALLOIS }, invitedParent]),
    ).toEqual([NEUILLY, LEVALLOIS]);
  });

  it("throws ForbiddenError from assertSchoolRole", () => {
    expect(() => assertSchoolRole([parent], NEUILLY, ["school_admin"])).toThrow(ForbiddenError);
    expect(() => assertSchoolRole([admin], NEUILLY, ["school_admin"])).not.toThrow();
  });
});

describe("perspectives", () => {
  it("orders perspectives admin > teacher > parent", () => {
    expect(perspectivesFor([parent, teacher, admin])).toEqual(["admin", "teacher", "parent"]);
    expect(perspectivesFor([guardian])).toEqual(["parent"]);
    expect(perspectivesFor([staff])).toEqual(["admin"]);
    expect(perspectivesFor([invitedParent])).toEqual([]);
  });

  it("honours a requested perspective the user holds, otherwise the highest one", () => {
    expect(resolvePerspective([parent, teacher], "parent")).toBe("parent");
    expect(resolvePerspective([parent, teacher], "admin")).toBe("teacher");
    expect(resolvePerspective([parent, teacher], undefined)).toBe("teacher");
    expect(resolvePerspective([parent, teacher], "nonsense")).toBe("teacher");
    expect(resolvePerspective([], "parent")).toBeNull();
  });
});
