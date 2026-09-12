import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_metadata' })
export class MetadataActividad {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'id_activity', type: 'int', nullable: true })
  idActivity?: number;

  @Column({ name: 'file', type: 'varchar', length: 500 })
  file: string;
}
