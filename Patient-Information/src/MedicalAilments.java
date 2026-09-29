import java.awt.EventQueue;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.JButton;
import javax.swing.JLabel;
import java.awt.Font;
import javax.swing.JTextField;
import javax.swing.UIManager;
import javax.swing.JSeparator;
import javax.swing.JComboBox;
import javax.swing.JOptionPane;

import components.DBConn;
import components.SidebarPanel;
import components.HeaderPanel;
import components.BodyPanel;
import components.DBConn;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

public class MedicalAilments extends JFrame {
	Connection connection = null;
	private static final long serialVersionUID = 1L;
	private JTextField searchTextBox;
	private JButton addProblemButton;
	private JComboBox<String> ailmentSelector;
	private JButton gotoPatientInfoButton;
	private JButton searchButton;

	public MedicalAilments() {
		setTitle("BMH : Medical Ailments");
		connection = DBConn.dbConnector();
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setBounds(100, 100, 815, 465);
		
		JPanel contentPane = new JPanel();
		contentPane.setBorder(new EmptyBorder(5, 5, 5, 5));

		setContentPane(contentPane);
		contentPane.setLayout(null);
		
		// Header Panel
		HeaderPanel headerPanel = new HeaderPanel("Medical Ailments");
		contentPane.add(headerPanel);
		
		// Side bar Panel
		SidebarPanel sidebarPanel = new SidebarPanel();
		contentPane.add(sidebarPanel);
		
		// Body Panel
		BodyPanel bodyPanel = new BodyPanel();
		contentPane.add(bodyPanel);
		
		// ------ start code here ------
		
		searchTextBox = new JTextField();
		searchTextBox.setFont(new Font("Tahoma", Font.PLAIN, 14));
		searchTextBox.setToolTipText("Search");
		searchTextBox.setBounds(51, 63, 302, 35);
		bodyPanel.add(searchTextBox);
		searchTextBox.setColumns(10);
		
		JLabel lblNewLabel_1 = new JLabel("What problem are you facing?");
		lblNewLabel_1.setBounds(51, 169, 500, 25);
		bodyPanel.add(lblNewLabel_1);
		lblNewLabel_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		// ------- Ailment Selection -------
		ailmentSelector = new JComboBox<String>();
		ailmentSelector.setFont(new Font("Tahoma", Font.PLAIN, 14));
		ailmentSelector.setBounds(51, 197, 500, 35);
		ailmentSelector.addItem("---Select-Problem---");
		String queryString = "SELECT DISTINCT description FROM ailments";
	    try {
	        Statement stmt = connection.createStatement();
	        ResultSet rs = stmt.executeQuery(queryString);
	        while (rs.next()) {
	        	ailmentSelector.addItem(rs.getString(1));
	        }
	        rs.close();
	        stmt.close();
	    } catch(Exception ex) {
			JOptionPane.showMessageDialog(null, ex);
		}
	    bodyPanel.add(ailmentSelector);
		
		gotoPatientInfoButton = new JButton("Next");
		gotoPatientInfoButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				String selectedProblem = String.valueOf(ailmentSelector.getSelectedItem());
                if ("---Select-Problem---".equals(selectedProblem)) {
                    JOptionPane.showMessageDialog(MedicalAilments.this, "No problem was selected!");
                } else {
                	try {
    			        connection.close();
					} catch (SQLException e1) {
						e1.printStackTrace();
					}
                	dispose();
                	PatientInfo patientInfo = new PatientInfo(selectedProblem);
                	patientInfo.setVisible(true);
                }
			}
		});
		gotoPatientInfoButton.setBounds(352, 243, 200, 35);
		bodyPanel.add(gotoPatientInfoButton);
		gotoPatientInfoButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		
		searchButton = new JButton("Search");
		searchButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
			}
		});
		searchButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				String searchText = searchTextBox.getText();
                if ("".equals(searchText)) {
                    JOptionPane.showMessageDialog(MedicalAilments.this, "No visit number was provided!");
                } else if (!isNumeric(searchText) || searchText.length() != 8) {
                	JOptionPane.showMessageDialog(MedicalAilments.this, "Invalid visit number!");
                } else {
                	PreparedStatement pst = null;
                	ResultSet rs = null;
                	
                	int visitingNumber = 0;
                	String problem = null;
                	String firstName = null;
                	String surName = null;
                	String dob = null;
                	String mobile = null;
                	String email = null;
                	String address = null;
                	String kFirstName = null;
                	String kSurName = null;
                	String kRelation = null;
                	String kMobile = null;
                	String kEmail = null;
                	String kAddress = null;
                	
                	try {
    					String query = "select * from patients where visitingNumber=?";
    					pst = connection.prepareStatement(query);
    					pst.setInt(1, Integer.valueOf(searchText));	
    					rs = pst.executeQuery();
    					int count = 0;
    					while(rs.next()) {
    						count = count+1;
    						visitingNumber = rs.getInt("visitingNumber");
    						problem = rs.getString("problem");
    						firstName = rs.getString("firstName");
    						surName = rs.getString("surName");
    						dob = rs.getString("dob");
    						mobile = rs.getString("mobile");
    						email = rs.getString("email");
    						address = rs.getString("address");
    						kFirstName = rs.getString("kFirstName");
    						kSurName = rs.getString("kSurName");
    						kRelation = rs.getString("kRelation");
    						kMobile = rs.getString("kMobile");
    						kEmail = rs.getString("kEmail");
    						kAddress = rs.getString("kAddress");
    					}
    					if (count == 1) {
    						rs.close();
        					pst.close();
    						connection.close();
    						dispose();
    						PatientDetails patientDetails = new PatientDetails(visitingNumber,problem,firstName,surName,dob,mobile,email,address,kFirstName,kSurName,kRelation,kMobile,kEmail,kAddress);
    						patientDetails.setVisible(true);    						
    					} else {
    						JOptionPane.showMessageDialog(null, "Redundant Data, Try Again !");
    					}    					
    				} catch(Exception ex) {
    					JOptionPane.showMessageDialog(null, ex);
    				} 
                	//                	finally {
                	//    					try {
                	//    						rs.close();
                	//        					pst.close();
                	//     			        connection.close();
                	//    					} catch (SQLException e1) {
                	//    						e1.printStackTrace();
                	//    					}
                	//    				}
                }
			}
		});
		searchButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		searchButton.setBounds(352, 63, 200, 35);
		bodyPanel.add(searchButton);
		
		JLabel lblRegisteredPatient = new JLabel("Registered Patient");
		lblRegisteredPatient.setFont(new Font("Tahoma", Font.BOLD, 16));
		lblRegisteredPatient.setBounds(50, 11, 500, 25);
		bodyPanel.add(lblRegisteredPatient);
		
		JSeparator separator_2 = new JSeparator();
		separator_2.setBounds(0, 124, 615, 2);
		bodyPanel.add(separator_2);
		
		JSeparator separator_2_1 = new JSeparator();
		separator_2_1.setBounds(0, 290, 615, 2);
		bodyPanel.add(separator_2_1);
		
		JLabel lblNewLabel_1_1 = new JLabel("Search Patient (Visiting Number)");
		lblNewLabel_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1.setBounds(51, 36, 500, 25);
		bodyPanel.add(lblNewLabel_1_1);
		
		JLabel lblNewPatient = new JLabel("New Patient");
		lblNewPatient.setFont(new Font("Tahoma", Font.BOLD, 16));
		lblNewPatient.setBounds(51, 137, 500, 25);
		bodyPanel.add(lblNewPatient);
		
		JLabel lblNewLabel_1_2 = new JLabel("Can't find your problem?");
		lblNewLabel_1_2.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_2.setBounds(51, 303, 500, 25);
		bodyPanel.add(lblNewLabel_1_2);
		
		addProblemButton = new JButton("Add Problem");
		addProblemButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
			}
		});
		addProblemButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				dispose();
				AddAilment addailment = new AddAilment();
				addailment.setVisible(true);
			}
		});
		addProblemButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		addProblemButton.setBounds(51, 329, 200, 35);
		bodyPanel.add(addProblemButton);
	}
	
	public static boolean isNumeric(String strNum) {
	    if (strNum == null) {
	        return false;
	    }
	    try {
	        double d = Double.parseDouble(strNum);
	    } catch (NumberFormatException nfe) {
	        return false;
	    }
	    return true;
	}

	
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {
					UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
					MedicalAilments frame = new MedicalAilments();
					frame.setVisible(true);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}
}
