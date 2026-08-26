-- CreateTable
CREATE TABLE `Gasto` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `emprendimientoId` VARCHAR(191) NOT NULL,
    `concepto` VARCHAR(191) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `monto` INTEGER NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Gasto_eventoId_idx`(`eventoId`),
    INDEX `Gasto_emprendimientoId_idx`(`emprendimientoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Gasto` ADD CONSTRAINT `Gasto_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
