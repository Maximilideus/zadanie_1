-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Package_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackageService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "PackageService_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackageService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkingHour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkingHour_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterId" TEXT,
    "locationId" TEXT,
    "date" DATETIME NOT NULL,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exception_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exception_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoShow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoShow_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_locationId_idx" ON "User"("locationId");

-- CreateIndex
CREATE INDEX "Service_locationId_idx" ON "Service"("locationId");

-- CreateIndex
CREATE INDEX "Package_locationId_idx" ON "Package"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageService_packageId_serviceId_key" ON "PackageService"("packageId", "serviceId");

-- CreateIndex
CREATE INDEX "Appointment_masterId_startAt_idx" ON "Appointment"("masterId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");

-- CreateIndex
CREATE INDEX "Appointment_locationId_idx" ON "Appointment"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentService_appointmentId_serviceId_key" ON "AppointmentService"("appointmentId", "serviceId");

-- CreateIndex
CREATE INDEX "WorkingHour_locationId_dayOfWeek_idx" ON "WorkingHour"("locationId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Exception_date_idx" ON "Exception"("date");

-- CreateIndex
CREATE INDEX "Exception_masterId_idx" ON "Exception"("masterId");

-- CreateIndex
CREATE INDEX "Exception_locationId_idx" ON "Exception"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "NoShow_appointmentId_key" ON "NoShow"("appointmentId");
