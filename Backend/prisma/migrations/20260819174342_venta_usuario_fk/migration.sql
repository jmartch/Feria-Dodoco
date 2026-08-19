-- CreateIndex
CREATE INDEX `Venta_usuarioId_idx` ON `Venta`(`usuarioId`);

-- AddForeignKey
ALTER TABLE `Venta` ADD CONSTRAINT `Venta_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
