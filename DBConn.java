package components;

import java.sql.*;
import javax.swing.*;

public class DBConn {
	Connection conn=null;
	public static Connection dbConnector() {		
		try {
			Class.forName("org.sqlite.JDBC");
			Connection conn = DriverManager.getConnection("jdbc:sqlite:C:\\EclipseProject\\Patient_Information\\database\\PatientInformation.sqlite");
			return conn;
		} catch(Exception e) {
			JOptionPane.showMessageDialog(null, e);
			return null;
		}
	}
}