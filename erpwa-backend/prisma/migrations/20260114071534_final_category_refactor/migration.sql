/*
  Warnings:

  - You are about to drop the column `category` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `subcategory` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the `LeadCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LeadCategory" DROP CONSTRAINT "LeadCategory_parentId_fkey";

-- DropForeignKey
ALTER TABLE "LeadCategory" DROP CONSTRAINT "LeadCategory_vendorId_fkey";

-- DropIndex
DROP INDEX "Lead_category_idx";

-- DropIndex
DROP INDEX "Lead_subcategory_idx";

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "category",
DROP COLUMN "subcategory";

-- DropTable
DROP TABLE "LeadCategory";
