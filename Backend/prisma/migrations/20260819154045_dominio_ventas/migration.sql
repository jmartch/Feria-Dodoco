-- CreateTable
CREATE TABLE `Categoria` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precio` INTEGER NOT NULL,
    `emprendimientoId` VARCHAR(191) NOT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Categoria_emprendimientoId_idx`(`emprendimientoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Producto` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precioSugerido` INTEGER NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `emprendimientoId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Producto_emprendimientoId_idx`(`emprendimientoId`),
    INDEX `Producto_categoriaId_idx`(`categoriaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetodoPago` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `comisionPct` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `emprendimientoId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MetodoPago_emprendimientoId_idx`(`emprendimientoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evento` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NULL,
    `meta` INTEGER NOT NULL,
    `catalogoBloqueado` BOOLEAN NOT NULL DEFAULT false,
    `estado` ENUM('ACTIVO', 'CERRADO') NOT NULL DEFAULT 'ACTIVO',
    `emprendimientoId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Evento_emprendimientoId_idx`(`emprendimientoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventoItem` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precio` INTEGER NOT NULL,
    `origenTipo` ENUM('CATEGORIA', 'PRODUCTO', 'MANUAL') NOT NULL,
    `origenId` VARCHAR(191) NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `emprendimientoId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventoItem_emprendimientoId_idx`(`emprendimientoId`),
    INDEX `EventoItem_eventoId_idx`(`eventoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Descuento` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `porcentaje` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `eventoId` VARCHAR(191) NOT NULL,
    `emprendimientoId` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Descuento_emprendimientoId_idx`(`emprendimientoId`),
    INDEX `Descuento_eventoId_idx`(`eventoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Venta` (
    `id` VARCHAR(191) NOT NULL,
    `uuid` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `descuentoNombre` VARCHAR(191) NULL,
    `descuentoPct` INTEGER NOT NULL DEFAULT 0,
    `descuentoValor` INTEGER NOT NULL DEFAULT 0,
    `total` INTEGER NOT NULL,
    `metodoPagoNombre` VARCHAR(191) NOT NULL,
    `comisionPct` INTEGER NOT NULL DEFAULT 0,
    `comisionValor` INTEGER NOT NULL DEFAULT 0,
    `neto` INTEGER NOT NULL,
    `recibido` INTEGER NOT NULL DEFAULT 0,
    `cambio` INTEGER NOT NULL DEFAULT 0,
    `creadaEnDispositivo` DATETIME(3) NOT NULL,
    `recibidaEnServidor` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `emprendimientoId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Venta_uuid_key`(`uuid`),
    INDEX `Venta_emprendimientoId_idx`(`emprendimientoId`),
    INDEX `Venta_eventoId_idx`(`eventoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VentaItem` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precioUnitario` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `ventaId` VARCHAR(191) NOT NULL,
    `emprendimientoId` VARCHAR(191) NOT NULL,

    INDEX `VentaItem_emprendimientoId_idx`(`emprendimientoId`),
    INDEX `VentaItem_ventaId_idx`(`ventaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Producto` ADD CONSTRAINT `Producto_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `Categoria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventoItem` ADD CONSTRAINT `EventoItem_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Descuento` ADD CONSTRAINT `Descuento_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Venta` ADD CONSTRAINT `Venta_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VentaItem` ADD CONSTRAINT `VentaItem_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `Venta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
