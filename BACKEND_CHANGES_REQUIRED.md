# Backend Changes Required for calculationBase='N' (NOS) Feature

## Overview
This document outlines the backend changes needed to support the new calculationBase='N' (NOS) option in the quotation system.

## Files to Modify

### 1. Entity Class
**File**: `[Backend]/entity/QuotationItem.java` (or equivalent)

**Changes**:
- Update the `calculationBase` field validation to accept 'N' as a valid value
- If using `@Pattern` validation, update to: `@Pattern(regexp = "[WRFS]|N", message = "Invalid calculation base")`
- If using an enum, add `NOS('N')` to the enum

**Example (if using String with @Pattern)**:
```java
@Column(name = "calculation_base", length = 1)
@Pattern(regexp = "[WRFS]|N", message = "Invalid calculation base. Must be W, RF, SF, or N")
private String calculationBase;
```

**Example (if using Enum)**:
```java
// In CalculationBase.java enum file
public enum CalculationBase {
    WEIGHT('W'),
    RUNNING_FEET('RF'),
    SQ_FEET('SF'),
    NOS('N'); // Add this new value
    
    private final char code;
    
    CalculationBase(char code) {
        this.code = code;
    }
    
    public char getCode() {
        return code;
    }
}
```

---

### 2. DTO Classes

#### Request DTO
**File**: `[Backend]/dto/QuotationItemDTO.java` or `QuotationItemRequest.java`

**Changes**:
- Update calculationBase field validation to accept 'N'
- Add validation annotation: `@Pattern(regexp = "[WRFS]|N")` or update enum

**Example**:
```java
@Pattern(regexp = "[WRFS]|N", message = "Calculation base must be W, RF, SF, or N")
private String calculationBase;
```

#### Response DTO
**File**: `[Backend]/dto/QuotationItemResponse.java` or `QuotationItemDTO.java` (response)

**Changes**:
- Ensure calculationBase field can return 'N'
- No validation needed for response DTOs, just ensure the field type supports 'N'

---

### 3. Service Layer
**File**: `[Backend]/service/QuotationService.java`

**Changes**:
- Review any business logic that specifically handles calculationBase values
- Ensure 'N' value is persisted correctly
- If there are any calculations or validations based on calculationBase, add support for 'N'

**Example check points**:
- Method: `createQuotation()` - Ensure it accepts and saves 'N'
- Method: `updateQuotation()` - Ensure it accepts and updates 'N'
- Method: `validateQuotationItem()` - If exists, ensure 'N' is valid

---

### 4. Controller
**File**: `[Backend]/controller/QuotationController.java`

**Changes**:
- Typically no changes needed if validation is handled at DTO/Entity level
- Verify POST and PUT endpoints accept 'N' in the calculationBase field
- Ensure error messages are clear if validation fails

---

### 5. Repository/DAO
**File**: `[Backend]/repository/QuotationItemRepository.java` or DAO equivalent

**Changes**:
- If there are custom queries filtering by calculationBase, ensure they handle 'N'
- If using native queries with hardcoded values, update them

**Example check**:
```java
// If you have queries like this, update them:
@Query("SELECT q FROM QuotationItem q WHERE q.calculationBase IN ('W', 'RF', 'SF')")
// Should become:
@Query("SELECT q FROM QuotationItem q WHERE q.calculationBase IN ('W', 'RF', 'SF', 'N')")
```

---

### 6. Validation Classes (if applicable)
**File**: Custom validators or validation configuration files

**Changes**:
- Update any custom validators that validate calculationBase
- Ensure they accept 'N' as a valid value

---

### 7. Database Migration (if applicable)
**File**: Database migration script (if using Flyway, Liquibase, etc.)

**Changes**:
- If calculationBase is stored as CHAR(1) with CHECK constraint, update the constraint
- If using ENUM type in database, add 'N' to the enum

**Example SQL (PostgreSQL)**:
```sql
-- If using CHECK constraint:
ALTER TABLE quotation_item 
DROP CONSTRAINT IF EXISTS chk_calculation_base;

ALTER TABLE quotation_item 
ADD CONSTRAINT chk_calculation_base 
CHECK (calculation_base IN ('W', 'RF', 'SF', 'N'));
```

**Example SQL (MySQL)**:
```sql
-- If using ENUM:
ALTER TABLE quotation_item 
MODIFY COLUMN calculation_base ENUM('W', 'RF', 'SF', 'N');
```

---

## Testing Checklist

After implementing backend changes, verify:

1. ✅ Creating quotation with calculationBase='N' succeeds
2. ✅ Updating quotation item with calculationBase='N' succeeds
3. ✅ Retrieving quotation item with calculationBase='N' returns correct value
4. ✅ Validation rejects invalid calculationBase values
5. ✅ Database properly stores 'N' value
6. ✅ Any reports/queries that filter by calculationBase handle 'N' correctly

---

## Notes

- The frontend will send 'N' as the calculationBase value when user selects NOS option
- When calculationBase='N', the quantity field contains the total Nos value (not weight)
- Weight should be 0 or null when calculationBase='N'
- The 'N' option is only available when there's exactly 1 calculation row (frontend validation)

---

## File Locations Summary

Based on typical Spring Boot structure:
- Entity: `src/main/java/[package]/entity/QuotationItem.java`
- DTO Request: `src/main/java/[package]/dto/QuotationItemDTO.java` or `QuotationItemRequest.java`
- DTO Response: `src/main/java/[package]/dto/QuotationItemResponse.java`
- Service: `src/main/java/[package]/service/QuotationService.java`
- Controller: `src/main/java/[package]/controller/QuotationController.java`
- Repository: `src/main/java/[package]/repository/QuotationItemRepository.java`
- Migrations: `src/main/resources/db/migration/` (if using Flyway)

