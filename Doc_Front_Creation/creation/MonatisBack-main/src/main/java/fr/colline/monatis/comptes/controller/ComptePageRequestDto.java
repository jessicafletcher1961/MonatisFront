package fr.colline.monatis.comptes.controller;

import java.io.Serializable;
import java.util.List;

public class ComptePageRequestDto implements Serializable {

	private static final long serialVersionUID = 4385308732805431153L;

	public Integer numeroPage;
	public Integer taillePage;
	public String recherche;
	public List<String> codesTypeFonctionnement;
	public List<String> nomsTitulaires;

}
