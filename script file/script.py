import pyodbc
import pandas as pd
import logging

# Set up logging
logging.basicConfig(filename='export_log.txt', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

logging.info('Script started')

# Connection string with password
conn_str = (
    r'DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};'
    r'DBQ=C:\Users\Hp\OneDrive\Desktop\testdb.accdb;'
    r'UID=mahmoud fikry;'
    r'PWD=555;'
)

try:
    # Connect to the database
    conn = pyodbc.connect(conn_str)
    logging.info('Connected to the database')

    # Export data (example: export to Excel)
    cursor = conn.cursor()
    cursor.execute("SELECT ID, Name FROM names")
    data = cursor.fetchall()
    logging.info('Data fetched successfully')

    # Get column names from the cursor
    columns = [column[0] for column in cursor.description]
    logging.info('Column names fetched successfully')

    # Save the data to a file (e.g., Excel)
    df = pd.DataFrame.from_records(data, columns=columns)
    df.to_excel('exported_data.xlsx', index=False)
    logging.info('Data exported to Excel successfully')

    # Close the connection
    conn.close()
    logging.info('Database connection closed')
except Exception as e:
    logging.error('An error occurred: %s', e)

logging.info('Script ended')
