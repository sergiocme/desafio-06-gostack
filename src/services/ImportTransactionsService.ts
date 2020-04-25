import fs from 'fs';
import csvParse from 'csv-parse';
import { getRepository, In, getCustomRepository } from 'typeorm';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface ImportededTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string | undefined;
}

interface ImportededTransactions {
  transactions: Array<ImportededTransaction>;
  categories: Array<string>;
}

class ImportTransactionsService {
  private async loadFile(filePath: string): Promise<ImportededTransactions> {
    const readStream = fs.createReadStream(filePath);
    const parser = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parsedStream = readStream.pipe(parser);
    const transactions: Array<ImportededTransaction> = [];
    const categories: Array<string> = [];

    parsedStream.on('data', line => {
      const [title, type, value, category] = line;
      transactions.push({ title, type, value, category });
      if (category) categories.push(category);
    });

    await new Promise(resolve => {
      parsedStream.on('end', resolve);
    });

    return { transactions, categories };
  }

  private removeDuplicateEntries(array: Array<string>): Array<string> {
    return array.filter(
      (element, index, self) => self.indexOf(element) === index,
    );
  }

  async execute(filePath: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const { transactions, categories } = await this.loadFile(filePath);

    const savedCategories = await categoriesRepository.find({
      where: { title: In(categories) },
    });

    const savedCategoriesTitle = savedCategories.map(
      category => category.title,
    );

    let categoriesToAdd = categories.filter(
      title => !savedCategoriesTitle.includes(title),
    );
    categoriesToAdd = this.removeDuplicateEntries(categoriesToAdd);

    const bulkCategories = categoriesRepository.create(
      categoriesToAdd.map(title => ({ title })),
    );

    await categoriesRepository.save(bulkCategories);

    const allCategories = [...bulkCategories, ...savedCategories];

    const bulkTransactions = transactionsRepository.create(
      transactions.map(({ title, type, value, category }) => ({
        title,
        type,
        value,
        category: allCategories.find(
          savedCategory => savedCategory.title === category,
        ),
      })),
    );

    await transactionsRepository.save(bulkTransactions);

    await fs.promises.unlink(filePath);

    return bulkTransactions.map(transaction => {
      const transactionWithoutCategoryId = { ...transaction };
      delete transactionWithoutCategoryId.category_id;
      return transactionWithoutCategoryId;
    });
  }
}

export default ImportTransactionsService;
