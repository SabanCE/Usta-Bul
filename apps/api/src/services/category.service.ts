import { query } from '../config/db';
import { NotFoundError } from '../errors/AppError';

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
}

export class CategoryService {
  async getAll(): Promise<Category[]> {
    try {
      const result = await query(
        'SELECT id, slug, name, icon, description FROM categories ORDER BY name ASC'
      );
      return result.rows;
    } catch (err: any) {
      // Veritabanı henüz hazır değilse varsayılan kategorileri döner
      return [
        { id: '1', slug: 'plumber', name: 'Sıhhi Tesisat', icon: 'wrench', description: 'Musluk, su kaçağı, gider ve boru tamiri' },
        { id: '2', slug: 'electrician', name: 'Elektrik & Aydınlatma', icon: 'zap', description: 'Sigorta, avize, priz ve kablolama' },
        { id: '3', slug: 'painter', name: 'Boya & Badana', icon: 'paint-brush', description: 'İç ve dış cephe boyama, alçı işleri' },
        { id: '4', slug: 'carpenter', name: 'Marangozluk & Mobilya', icon: 'hammer', description: 'Mobilya montajı, kapı ve ahşap tamiri' },
        { id: '5', slug: 'locksmith', name: 'Çilingir & Kilit', icon: 'key', description: '7/24 kapı açma, barel ve kilit değişimi' },
        { id: '6', slug: 'appliance', name: 'Beyaz Eşya Servisi', icon: 'tv', description: 'Buzdolabı, çamaşır ve bulaşık makinesi tamiri' },
        { id: '7', slug: 'renovation', name: 'Ev Tadilatı', icon: 'home', description: 'Banyo, mutfak yenileme ve fayans döşeme' },
      ];
    }
  }

  async getBySlug(slug: string): Promise<Category> {
    const result = await query(
      'SELECT id, slug, name, icon, description FROM categories WHERE slug = $1',
      [slug]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(`'${slug}' kategorisi bulunamadı.`);
    }

    return result.rows[0];
  }
}

export const categoryService = new CategoryService();
